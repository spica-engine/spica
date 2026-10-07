import fs from "fs";
import path from "path";
import {FunctionAssetStrategy, StoredObject} from "@spica-server/interface-function-asset-storage";

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

  async upload(key: string, filePath: string): Promise<void> {
    const target = this.buildPath(key);
    await this.ensureDir(target);
    await fs.promises.copyFile(filePath, target);
  }

  async download(key: string, filePath: string): Promise<void> {
    await this.ensureDir(filePath);
    await fs.promises.copyFile(this.buildPath(key), filePath);
  }

  async list(prefix: string): Promise<StoredObject[]> {
    const objects: StoredObject[] = [];
    const walk = async (dir: string) => {
      const entries = await fs.promises.readdir(dir, {withFileTypes: true}).catch(e => {
        if (e.code === "ENOENT") return [];
        throw e;
      });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
          continue;
        }
        const key = path.relative(this.storagePath, fullPath).split(path.sep).join("/");
        if (!key.startsWith(prefix)) continue;
        const stat = await fs.promises.stat(fullPath);
        objects.push({key, lastModified: stat.mtime});
      }
    };
    await walk(this.storagePath);
    return objects;
  }
}
