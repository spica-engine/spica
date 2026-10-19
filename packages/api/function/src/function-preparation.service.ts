import {Inject, Injectable} from "@nestjs/common";
import fs from "fs";
import path from "path";
import {rimraf} from "rimraf";
import {Scheduler} from "@spica-server/function-scheduler";
import {Function, Options, FUNCTION_OPTIONS} from "@spica-server/interface-function";
import {FunctionAssetFilename} from "@spica-server/interface-function-asset-storage";

@Injectable()
export class FunctionPreparationService {
  constructor(
    private readonly scheduler: Scheduler,
    @Inject(FUNCTION_OPTIONS) private readonly options: Options
  ) {}

  private getFunctionRoot(fn: Function): string {
    return path.join(this.options.root, fn.name);
  }

  indexFilename(fn: Function): FunctionAssetFilename {
    return this.scheduler.builders.get(fn.language).description.entrypoints
      .build as FunctionAssetFilename;
  }

  installPackages(fn: Function, qualifiedNames: string | string[]): Promise<void> {
    return this.scheduler.pkgmanagers.get("node").install(this.getFunctionRoot(fn), qualifiedNames);
  }

  build(fn: Function): Promise<void> {
    const builder = this.scheduler.builders.get(fn.language);
    const outDirRelative = path.join(".", this.options.outDir);
    return builder.build({
      cwd: this.getFunctionRoot(fn),
      outDir: outDirRelative,
      entrypoints: builder.description.entrypoints
    });
  }

  async prepare(fn: Function): Promise<void> {
    await this.installPackages(fn, []);
    await this.build(fn);
  }

  prepareIndex(fn: Function): Promise<void> {
    return this.build(fn);
  }

  preparePackageJson(fn: Function): Promise<void> {
    return this.installPackages(fn, []);
  }

  async deleteFunctionDirectory(name: string): Promise<void> {
    await rimraf(path.join(this.options.root, name));
  }

  async renameFunctionDirectory(from: string, to: string): Promise<void> {
    const source = path.join(this.options.root, from);
    const sourceExists = await fs.promises.access(source).then(
      () => true,
      () => false
    );
    if (!sourceExists) return;

    const target = path.join(this.options.root, to);
    await rimraf(target);
    await fs.promises.rename(source, target);
  }

  async readFileBuffer(fn: Function, filename: string): Promise<Buffer | null> {
    const filePath = path.join(this.getFunctionRoot(fn), filename);
    try {
      return await fs.promises.readFile(filePath);
    } catch (e: any) {
      if (e.code === "ENOENT") return null;
      throw e;
    }
  }

  async writeFileBuffer(fn: Function, filename: string, data: Buffer): Promise<void> {
    const filePath = path.join(this.getFunctionRoot(fn), filename);
    await fs.promises.mkdir(path.dirname(filePath), {recursive: true});
    await fs.promises.writeFile(filePath, data);
  }
}
