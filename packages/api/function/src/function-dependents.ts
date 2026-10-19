import {Inject, Injectable, Logger} from "@nestjs/common";
import path from "path";
import {Scheduler} from "@spica-server/function-scheduler";
import {FunctionService} from "@spica-server/function-services";
import {
  Function,
  FunctionChangePlan,
  FUNCTION_OPTIONS,
  Options
} from "@spica-server/interface-function";
import {refreshPlan} from "./change.js";
import {FunctionPreparationService} from "./function-preparation.service.js";

const PACKAGE_READ_CONCURRENCY = 16;
const LOCAL_DEPENDENCY_PROTOCOL = "file:";

@Injectable()
export class FunctionDependents {
  private readonly logger = new Logger(FunctionDependents.name);

  constructor(
    private readonly fs: FunctionService,
    private readonly scheduler: Scheduler,
    @Inject(FUNCTION_OPTIONS) private readonly options: Options,
    private readonly preparationService: FunctionPreparationService
  ) {}

  async refreshPlan(fn: Function): Promise<FunctionChangePlan> {
    const dependents = await this.find(fn);
    await this.rebuildBundled(dependents);
    return refreshPlan(
      fn._id.toString(),
      dependents.map(dependent => dependent._id.toString())
    );
  }

  async find(fn: Function): Promise<Function[]> {
    const fns = await this.fs.find({}, {projection: {_id: 1, name: 1, language: 1}});
    const fnsByName = new Map(fns.map(f => [f.name, f]));

    const imports = await mapWithConcurrency(fns, PACKAGE_READ_CONCURRENCY, f =>
      this.findImports(f)
    );
    const importsByName = new Map(
      fns.map((f, i) => [f.name, imports[i].filter(name => fnsByName.has(name))])
    );

    const importersByName = new Map<string, string[]>();
    for (const [importer, imported] of importsByName) {
      for (const name of imported) {
        importersByName.set(name, [...(importersByName.get(name) ?? []), importer]);
      }
    }

    const affected = new Set<string>();
    const pending = [fn.name];
    while (pending.length) {
      for (const importer of importersByName.get(pending.pop()) ?? []) {
        if (importer != fn.name && !affected.has(importer)) {
          affected.add(importer);
          pending.push(importer);
        }
      }
    }

    const ordered: Function[] = [];
    const visited = new Set<string>();
    const visit = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);
      for (const imported of importsByName.get(name)) {
        if (affected.has(imported)) visit(imported);
      }
      ordered.push(fnsByName.get(name));
    };
    affected.forEach(visit);

    return ordered;
  }

  private async findImports(fn: Function): Promise<string[]> {
    const root = path.resolve(this.options.root);
    const cwd = path.join(root, fn.name);
    try {
      const packages = await this.scheduler.pkgmanagers.get("node").ls(cwd);
      return packages
        .filter(pkg => pkg.version?.startsWith(LOCAL_DEPENDENCY_PROTOCOL))
        .map(pkg => path.resolve(cwd, pkg.version.slice(LOCAL_DEPENDENCY_PROTOCOL.length)))
        .filter(target => path.dirname(target) == root)
        .map(target => path.basename(target));
    } catch (error) {
      this.logger.warn(
        `Couldn't read the dependencies of function ${fn.name}. Reason: ${error instanceof Error ? error.message : error}`
      );
      return [];
    }
  }

  private async rebuildBundled(dependents: Function[]) {
    for (const dependent of dependents) {
      if (!this.scheduler.builders.get(dependent.language)?.bundlesDependencies) continue;
      await this.preparationService
        .build(dependent)
        .catch(error =>
          this.logger.error(
            `Failed to rebuild function ${dependent.name} after a function it imports changed. Reason: ${error instanceof Error ? error.message : error}`
          )
        );
    }
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  map: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const work = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await map(items[index]);
    }
  };
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, work));
  return results;
}
