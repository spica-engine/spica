import fs from "fs";
import {FileStore} from "@tus/file-store";
import {BaseStrategy} from "./base-strategy";

export class Default extends BaseStrategy {
  constructor(
    private path: string,
    private publicUrl: string,
    resumableUploadExpiresIn: number
  ) {
    super(resumableUploadExpiresIn);
    this.publicUrl = publicUrl;
    this.initializeTusServer();
  }

  protected initializeTusServer() {
    const datastore = new FileStore({
      directory: this.path,
      expirationPeriodInMilliseconds: this.resumableUploadExpiresIn
    });

    super.initializeTusServer(datastore);
  }

  async writeStream(id: string, data: fs.ReadStream, mimeType?: string): Promise<void> {
    await this.ensureStorageDiskExists();
    const objectPath = this.buildPath(id);

    if (this.isDirectory(id)) {
      await this.createDir(objectPath);
      return;
    }

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

    if (this.isDirectory(id)) {
      await this.createDir(objectPath);
      return;
    }

    return fs.promises.writeFile(objectPath, data);
  }

  async delete(id: string) {
    await this.ensureStorageDiskExists();
    const objectPath = this.buildPath(id);

    if (this.isDirectory(id)) {
      await this.removeDir(objectPath);
      return;
    }

    return fs.promises.unlink(objectPath);
  }

  url(id: string) {
    return Promise.resolve(`${this.publicUrl}/storage/${id}/view`);
  }

  private buildPath(id: string) {
    return `${this.path}/${id}`;
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

  async rename(oldName: string, newName: string): Promise<void> {
    const oldPath = this.buildPath(oldName);
    const newPath = this.buildPath(newName);
    try {
      await fs.promises.rename(oldPath, newPath);
    } catch (err) {
      console.error(`Error renaming file from ${oldName} to ${newName}:`, err);
      throw err;
    }
  }

  private isDirectory(id) {
    if (id.endsWith("/")) {
      return true;
    }
    return false;
  }

  private createDir(objectPath) {
    return fs.promises.mkdir(objectPath, {recursive: true});
  }

  private removeDir(objectPath) {
    return fs.promises.rm(objectPath, {recursive: true});
  }
}
