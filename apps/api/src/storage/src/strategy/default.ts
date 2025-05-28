import fs from "fs";
import {Strategy} from "./strategy";

export class Default implements Strategy {
  constructor(
    private path: string,
    private publicUrl: string
  ) {
    this.publicUrl = publicUrl;
  }

  async writeStream(id: string, data: fs.ReadStream, mimeType?: string): Promise<void> {
    await this.ensureStorageDiskExists();
    const objectPath = this.buildPath(id);

    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(objectPath);

      writeStream.on("error", err => {
        console.error(err);
        return reject(err);
      });

      writeStream.on("finish", () => {
        return resolve();
      });

      data.pipe(writeStream);
    });
  }

  async read(id: string) {
    await this.ensureStorageDiskExists();
    const objectPath = this.buildPath(id);
    return fs.promises.readFile(objectPath);
  }

  async write(id: string, data: Buffer) {
    await this.ensureStorageDiskExists();
    const objectPath = this.buildPath(id);
    return fs.promises.writeFile(objectPath, data);
  }

  async delete(id: string) {
    await this.ensureStorageDiskExists();
    const objectPath = this.buildPath(id);
    return fs.promises.unlink(objectPath);
  }

  url(id: string) {
    return Promise.resolve(`${this.publicUrl}/storage/${id}/view`);
  }

  private buildPath(id: string) {
    return `${this.path}/${id}.storageobj`;
  }

  private async ensureStorageDiskExists() {
    const hasAccess = await fs.promises
      .access(this.path, fs.constants.F_OK)
      .then(() => true)
      .catch(() => false);
    if (!hasAccess) {
      return fs.promises.mkdir(this.path);
    }
    return Promise.resolve();
  }
}
