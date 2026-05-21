import fs from "fs";
import path from "path";
import {FunctionAssetStrategy} from "@spica-server/interface-function-asset-storage";

export class DefaultStrategy implements FunctionAssetStrategy {
  constructor(private readonly storagePath: string) {}

  private buildPath(key: string): string {
    return path.join(this.storagePath, key);
  }

  private async ensureDir(filePath: string): Promise<void> {
    await fs.promises.mkdir(path.dirname(filePath), {recursive: true});
  }

  async read(key: string): Promise<Buffer> {
    return fs.promises.readFile(this.buildPath(key));
  }

  async write(key: string, data: Buffer): Promise<void> {
    const filePath = this.buildPath(key);
    await this.ensureDir(filePath);
    await fs.promises.writeFile(filePath, data);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.buildPath(key);
    await fs.promises.unlink(filePath).catch(e => {
      if (e.code !== "ENOENT") throw e;
    });
  }

  async exists(key: string): Promise<boolean> {
    return fs.promises
      .access(this.buildPath(key))
      .then(() => true)
      .catch(() => false);
  }
}
