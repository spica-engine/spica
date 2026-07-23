import {Inject, Injectable} from "@nestjs/common";
import fs from "fs";
import path from "path";
import {rimraf} from "rimraf";
import {Scheduler} from "@spica-server/function-scheduler";
import {Function, Options, FUNCTION_OPTIONS} from "@spica-server/interface-function";

/**
 * Owns the install-packages + build steps for a function.
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

  /** Re-prepare only the index file: rebuild without reinstalling packages. */
  prepareIndex(fn: Function): Promise<void> {
    return this.build(fn);
  }

  /** Re-prepare only package.json: reinstall packages without rebuilding. */
  preparePackageJson(fn: Function): Promise<void> {
    return this.installPackages(fn, []);
  }

  /** Delete a function's directory on disk. rimraf is idempotent — safe to call even if already gone. */
  async deleteFunctionDirectory(name: string): Promise<void> {
    await rimraf(path.join(this.options.root, name));
  }

  /**
   * Read a file from the function's directory. Returns null when the file does
   * not exist (ENOENT), throws for any other I/O error.
   */
  async readFileBuffer(fn: Function, filename: string): Promise<Buffer | null> {
    const filePath = path.join(this.getFunctionRoot(fn), filename);
    try {
      return await fs.promises.readFile(filePath);
    } catch (e: any) {
      if (e.code === "ENOENT") return null;
      throw e;
    }
  }

  /**
   * Write a buffer to a file in the function's directory.
   * Creates parent directories if they don't exist.
   */
  async writeFileBuffer(fn: Function, filename: string, data: Buffer): Promise<void> {
    const filePath = path.join(this.getFunctionRoot(fn), filename);
    await fs.promises.mkdir(path.dirname(filePath), {recursive: true});
    await fs.promises.writeFile(filePath, data);
  }
}
