import {Strategy} from "./strategy";
import * as AWS from "aws-sdk";

export class AWSS3 implements Strategy {
  s3: AWS.S3;
  constructor(private credentialsPath: string, private bucketName: string) {
    AWS.config.loadFromPath(this.credentialsPath);
    this.s3 = new AWS.S3();
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

  write(id: string, data: Buffer, mimeType?: string): Promise<void> {
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
}
