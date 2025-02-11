import {ReadStream} from "fs";
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

  writeStream(id: string, data: ReadStream, contentType: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const writeStream = this.bucket.file(id).createWriteStream({
        contentType
      });

      writeStream.on("finish", () => {
        return resolve();
      });

      writeStream.on("error", err => {
        console.error(err);
        return reject(err);
      });

      data.pipe(writeStream);
    });
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

  url(id: string) {
    return this.bucket
      .file(id)
      .getMetadata()
      .then(([res]) => {
        const url = new URL(res.mediaLink);
        url.searchParams.delete("generation");
        return url.toString();
      });
  }
}
