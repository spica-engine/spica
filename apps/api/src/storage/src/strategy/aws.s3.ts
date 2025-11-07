import {ReadStream} from "fs";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command
} from "@aws-sdk/client-s3";
import {readFileSync} from "fs";
import {S3Store} from "@tus/s3-store";
import {BaseStrategy} from "./base-strategy";

export class AWSS3 extends BaseStrategy {
  s3: S3Client;

  constructor(
    private credentialsPath: string,
    private bucketName: string,
    resumableUploadExpiresIn: number
  ) {
    super(resumableUploadExpiresIn);
    const config = this.getConfig();
    this.s3 = new S3Client({
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      },
      region: config.region
    });

    this.initializeTusServer();
  }

  protected initializeTusServer() {
    const config = this.getConfig();

    const datastore = new S3Store({
      partSize: 8 * 1024 * 1024, // Each uploaded part will have ~8MiB,
      s3ClientConfig: {
        bucket: this.bucketName,
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey
        }
      },
      expirationPeriodInMilliseconds: this.resumableUploadExpiresIn
    });

    super.initializeTusServer(datastore);
  }

  getConfig() {
    return JSON.parse(readFileSync(this.credentialsPath, "utf-8"));
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

  async rename(oldPrefix: string, newPrefix: string): Promise<void> {
    let continuationToken: string | undefined = undefined;
    do {
      const listResponse = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: oldPrefix,
          ContinuationToken: continuationToken
        })
      );

      const objects = listResponse.Contents ?? [];

      await Promise.all(
        objects.map(async obj => {
          const oldKey = obj.Key!;
          const newKey = oldKey.replace(oldPrefix, newPrefix);

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
        })
      );

      continuationToken = listResponse.IsTruncated ? listResponse.NextContinuationToken : undefined;
    } while (continuationToken);
  }
}
