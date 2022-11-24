import {Strategy} from "./strategy";
import {Storage, Bucket} from "@google-cloud/storage";

export class GCloud implements Strategy {
  private storage: Storage;
  private bucket: Bucket;

  constructor(serviceAccountPath: string, bucketName: string) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;
    this.storage = new Storage();
    this.bucket = this.storage.bucket(bucketName);
  }

  write(id: string, data: Buffer, contentType: string) {
    return this.bucket.file(id).save(data, {contentType});
  }

  read(id: string) {
    return this.bucket
      .file(id)
      .download()
      .then(([res]) => Buffer.from(res.buffer));
  }

  delete(id: string) {
    this.bucket.file(id).delete();
  }
}
