import * as fs from "fs";
import * as path from "path";

import {Storage, Bucket} from "@google-cloud/storage";

export abstract class Strategy {
  abstract read(id: string): Promise<Buffer> | Buffer;
  abstract write(id: string, data: any): Promise<void>;
  abstract delete(id: string);
  abstract url(id: string): Promise<string> | string;
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
      return fs.promises.readFile(objectPath);
    } else {
      return undefined;
    }
  }

  write(id: string, data: any) {
    const objectPath = this.buildPath(id);
    return fs.promises.writeFile(objectPath, data);
  }

  delete(id: string) {
    const objectPath = this.buildPath(id);
    if (fs.existsSync(objectPath)) {
      fs.promises.unlink(objectPath);
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

  bucket: Bucket;

  constructor(serviceAccountPath: string, bucketName: string) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;
    this.storage = new Storage();
    this.bucket = this.storage.bucket(bucketName);
  }

  write(id: string, data: any): Promise<void> {
    return this.bucket.file(id).save(data);
  }

  read(id: string) {
    return this.bucket
      .file(id)
      .download()
      .then(res => Buffer.from(res[0].buffer));
  }

  delete(id: string) {
    this.bucket.file(id).delete();
  }

  url(id: string) {
    return this.bucket
      .file(id)
      .getMetadata()
      .then(res => res[0].mediaLink);
  }
}
