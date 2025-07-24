import {ReadStream} from "fs";
import {Strategy} from "./strategy";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand
} from "@aws-sdk/client-s3";
import {readFileSync} from "fs";
export class AWSS3 implements Strategy {
  s3: S3Client;

  constructor(
    private credentialsPath: string,
    private bucketName: string
  ) {
    const config = JSON.parse(readFileSync(this.credentialsPath, "utf-8"));
    this.s3 = new S3Client({
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      },
      region: config.region
    });
  }

  writeStream(id: string, data: ReadStream, mimeType?: string): Promise<void> {
    return this.write(id, data, mimeType);
  }

  async read(id: string): Promise<Buffer> {
    const res = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: id
      })
    );

    return new Promise((resolve, reject) => {
      const chunks: any[] = [];
      const stream = res.Body as NodeJS.ReadableStream;

      stream.on("data", chunk => chunks.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });
  }

  async write(id: string, data: Buffer | ReadStream, mimeType?: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: id,
        Body: data,
        ContentType: mimeType
      })
    );
  }

  async delete(id: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: id
      })
    );
  }

  async url(id: string): Promise<string> {
    const region = await this.s3.config.region();
    return `https://${this.bucketName}.s3.${region}.amazonaws.com/${id}`;
  }

  async rename(oldKey: string, newKey: string): Promise<void> {
    await this.s3.send(
      new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${encodeURIComponent(oldKey)}`,
        Key: newKey
      })
    );
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: oldKey
      })
    );
  }

  async handleResumableUpload(req, res) {}
}
