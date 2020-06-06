import * as fs from "fs";
import * as path from "path";
import {Storage, Bucket} from "@google-cloud/storage";

export abstract class Strategy {
  abstract read(id: string);
  abstract writeSync(id: string, data: any): void;
  abstract writeAsync(id: string, data: any): Promise<void>;
  abstract delete(id: any);
  abstract url(id: string);
}

export class Default implements Strategy {
  path = "";
  publicUrl = "";

  constructor(_path: string, publicUrl: string) {
    this.publicUrl = publicUrl;
    this.path = path.resolve(_path, "storage");
    if (!fs.existsSync(this.path)) {
      fs.mkdirSync(this.path);
    }
  }

  read(id: string) {
    const objectPath = this.buildPath(id);
    if (fs.existsSync(objectPath)) {
      return fs.readFileSync(objectPath);
    } else {
      return undefined;
    }
  }

  writeSync(id: string, data: any): void {
    const objectPath = this.buildPath(id);
    fs.writeFileSync(objectPath, data);
  }

  writeAsync(id: string, data: any): Promise<void> {
    const objectPath = this.buildPath(id);
    return fs.promises.writeFile(objectPath, data);
  }

  delete(object: any) {
    const objectPath = this.buildPath(object._id);
    if (fs.existsSync(objectPath)) {
      fs.unlinkSync(objectPath);
    }
  }

  url(id: string) {
    return `${this.publicUrl}/storage/${id}`;
  }

  buildPath(id: string) {
    return `${this.path}/${id}.storageobj`;
  }
}

export class GCloud implements Strategy {
  storage: Storage;

  bucketName = "spica_uniqueid";

  bucket: Bucket = undefined;

  constructor(path: string) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path;
    this.storage = new Storage();
    this.checkBucket();
  }

  async checkBucket() {
    if (!this.bucket) {
      const bucket = (await this.storage.getBuckets())[0].some(
        bucket => bucket.name == this.bucketName
      );
      if (!bucket) {
        await this.storage.createBucket(this.bucketName);
        this.bucket = this.storage.bucket(this.bucketName);
      }
    }
  }

  read(id: string) {
    return this.bucket
      .file(id)
      .download()
      .then(res => res[0]);
  }
  writeSync(id: string, data: any): void {}
  writeAsync(id: string, data: any): Promise<any> {
    const filePath = `${__dirname}/${id}`;
    fs.writeFileSync(filePath, data);
    return this.bucket.upload(filePath, {
      gzip: true,
      metadata: {
        cacheControl: "public, max-age=31536000"
      }
    });
  }
  delete(id: any) {
    this.bucket.file(id).delete();
  }
  url(id: string) {
    this.bucket
      .file(id)
      .getMetadata()
      .then(([meta]) => meta.mediaLink);
  }
}
