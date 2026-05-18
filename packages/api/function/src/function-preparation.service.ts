import {Inject, Injectable} from "@nestjs/common";
import path from "path";
import {Scheduler} from "@spica-server/function-scheduler";
import {Function, Options, FUNCTION_OPTIONS} from "@spica-server/interface-function";

/**
 * Owns the install-packages + compile steps for a function.
 * Injected by FunctionEngine, FunctionAssetWatcher, and FunctionAssetReconciler
 * to avoid the circular dependency that previously required registerPrepareCallback.
 */
@Injectable()
export class FunctionPreparationService {
  constructor(
    private readonly scheduler: Scheduler,
    @Inject(FUNCTION_OPTIONS) private readonly options: Options
  ) {}

  private getFunctionRoot(fn: Function): string {
    return path.join(this.options.root, fn.name);
  }

  installPackages(fn: Function, qualifiedNames: string | string[]): Promise<void> {
    return this.scheduler.pkgmanagers.get("node").install(this.getFunctionRoot(fn), qualifiedNames);
  }

  compile(fn: Function): Promise<void> {
    const language = this.scheduler.languages.get(fn.language);
    const outDirRelative = path.join(".", this.options.outDir);
    return language.compile({
      cwd: this.getFunctionRoot(fn),
      outDir: outDirRelative,
      entrypoints: language.description.entrypoints
    });
  }

  async prepare(fn: Function): Promise<void> {
    await this.installPackages(fn, []);
    await this.compile(fn);
  }
}
