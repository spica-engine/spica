import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command
} from "@aws-sdk/client-s3";
import fs, {readFileSync} from "fs";
import {Readable} from "stream";
import {pipeline} from "stream/promises";
import {FunctionAssetStrategy, StoredObject} from "@spica-server/interface-function-asset-storage";

interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export class AWSS3Strategy implements FunctionAssetStrategy {
  private readonly s3: S3Client;

  constructor(
    private readonly credentialsPath: string | undefined,
    private readonly bucketName: string,
    s3?: S3Client
  ) {
    if (s3) {
      this.s3 = s3;
    } else if (this.credentialsPath) {
      const config = this.getCredentials();
      this.s3 = new S3Client({
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey
        },
        region: config.region
      });
    } else {
      // No credentials file provided: fall back to the AWS SDK default
      // credential provider chain (environment variables, web identity tokens
      // such as EKS IRSA, ECS/EC2 instance profiles, shared config files).
      this.s3 = new S3Client({});
    }
  }

  private getCredentials(): AwsCredentials {
    return JSON.parse(readFileSync(this.credentialsPath!, "utf-8"));
  }

  private async getObjectBody(key: string): Promise<Readable> {
    const res = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      })
    );
    return res.Body as Readable;
  }

  private async putObject(key: string, body: Buffer | Readable, contentLength?: number) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ...(contentLength === undefined ? {} : {ContentLength: contentLength})
      })
    );
  }

  async read(key: string): Promise<Buffer> {
    const stream = await this.getObjectBody(key);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });
  }

  async write(key: string, data: Buffer): Promise<void> {
    await this.putObject(key, data);
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      })
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.s3.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key
        })
      );
      return true;
    } catch (e: any) {
      if (e.name === "NotFound" || e.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw e;
    }
  }

  async upload(key: string, filePath: string): Promise<void> {
    const {size} = await fs.promises.stat(filePath);
    await this.putObject(key, fs.createReadStream(filePath), size);
  }

  async download(key: string, filePath: string): Promise<void> {
    await pipeline(await this.getObjectBody(key), fs.createWriteStream(filePath));
  }

  async list(prefix: string): Promise<StoredObject[]> {
    const objects: StoredObject[] = [];
    let continuationToken: string | undefined;
    do {
      const res = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken
        })
      );
      for (const object of res.Contents ?? []) {
        objects.push({key: object.Key!, lastModified: object.LastModified!});
      }
      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (continuationToken);
    return objects;
  }
}
