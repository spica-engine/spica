import {ReadStream} from "fs";
import {Strategy} from "./strategy";
import AWS from "aws-sdk";

export class AWSS3 implements Strategy {
  s3: AWS.S3;
  constructor(
    private credentialsPath: string,
    private bucketName: string
  ) {
    AWS.config.loadFromPath(this.credentialsPath);
    this.s3 = new AWS.S3();
  }

  writeStream(id: string, data: ReadStream, mimeType?: string): Promise<void> {
    return this.write(id, data, mimeType);
  }

  read(id: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      this.s3.getObject({Bucket: this.bucketName, Key: id}, (err, data) => {
        if (err) {
          return reject(err);
        }

        return resolve(data.Body as Buffer);
      });
    });
  }

  write(id: string, data: Buffer | ReadStream, mimeType?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.s3.upload(
        {Bucket: this.bucketName, Key: id, Body: data, ContentType: mimeType},
        (err, data) => {
          if (err) {
            return reject(err);
          }

          return resolve();
        }
      );
    });
  }

  delete(id: string): void | Promise<void> {
    return new Promise((resolve, reject) => {
      this.s3.deleteObject({Bucket: this.bucketName, Key: id}, (err, data) => {
        if (err) {
          return reject(err);
        }

        return resolve();
      });
    });
  }

  url(id: string): Promise<string> {
    // @TODO: find a way to get object location instead of this
    return Promise.resolve(
      `https://${this.bucketName}.s3.${AWS.config.region}.amazonaws.com/${id}`
    );
  }
}
