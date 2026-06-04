import {ReadStream} from "fs";
import {Readable} from "stream";
import {
  S3Client,
  GetObjectCommand,
  GetObjectCommandInput,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  CopyObjectCommand,
  ListObjectsV2Command
} from "@aws-sdk/client-s3";
import {readFileSync} from "fs";
import {S3Store} from "@tus/s3-store";
import {BaseStrategy} from "./base-strategy.js";
import {ProxyReadResult} from "./strategy.js";
import {StorageObjectMeta} from "@spica-server/interface-storage";
import type {S3ClientConfig} from "@aws-sdk/client-s3";

export class AWSS3 extends BaseStrategy {
  s3: S3Client;

  constructor(
    private credentialsPath: string | undefined,
    private bucketName: string,
    resumableUploadExpiresIn: number
  ) {
    super(resumableUploadExpiresIn);
    this.s3 = new S3Client(this.getClientConfig());

    this.initializeTusServer();
  }

  protected initializeTusServer() {
    const datastore = new S3Store({
      partSize: 8 * 1024 * 1024, // Each uploaded part will have ~8MiB,
      s3ClientConfig: {
        bucket: this.bucketName,
        ...this.getClientConfig()
      },
      expirationPeriodInMilliseconds: this.resumableUploadExpiresIn
    });

    super.initializeTusServer(datastore);
  }

  getConfig() {
    return JSON.parse(readFileSync(this.credentialsPath!, "utf-8"));
  }

  private getClientConfig(): S3ClientConfig {
    // When no credentials file is provided, fall back to the AWS SDK default
    // credential provider chain (environment variables, web identity tokens
    // such as EKS IRSA, ECS/EC2 instance profiles, shared config files).
    if (!this.credentialsPath) {
      return {};
    }
    const config = this.getConfig();
    return {
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      },
      region: config.region
    };
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
    let continuationToken: string | undefined = undefined;
    do {
      const listResponse = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: id,
          ContinuationToken: continuationToken
        })
      );

      const objects = listResponse.Contents ?? [];

      if (objects.length > 0) {
        await this.s3.send(
          new DeleteObjectsCommand({
            Bucket: this.bucketName,
            Delete: {
              Objects: objects.map(obj => ({Key: obj.Key!}))
            }
          })
        );
      }

      continuationToken = listResponse.IsTruncated ? listResponse.NextContinuationToken : undefined;
    } while (continuationToken);
  }

  async url(id: string): Promise<string> {
    const region = await this.s3.config.region();
    return `https://${this.bucketName}.s3.${region}.amazonaws.com/${id}`;
  }

  async proxyRead(
    id: string,
    requestHeaders: Record<string, string>,
    _meta: StorageObjectMeta
  ): Promise<ProxyReadResult> {
    const input: GetObjectCommandInput = {
      Bucket: this.bucketName,
      Key: id
    };

    const headerMappings: [string, (v: string) => void][] = [
      ["if-none-match",     v => { input.IfNoneMatch = v; }],
      ["if-match",          v => { input.IfMatch = v; }],
      ["if-modified-since", v => { input.IfModifiedSince = new Date(v); }],
      ["if-unmodified-since", v => { input.IfUnmodifiedSince = new Date(v); }],
      ["range",             v => { input.Range = v; }]
    ];
    for (const [header, apply] of headerMappings) {
      if (requestHeaders[header]) apply(requestHeaders[header]);
    }

    try {
      const response = await this.s3.send(new GetObjectCommand(input));
      const statusCode = response.$metadata.httpStatusCode ?? 200;

      const headers = Object.fromEntries(
        (
          [
            ["content-type", response.ContentType],
            ["content-length", response.ContentLength !== undefined ? String(response.ContentLength) : undefined],
            ["etag", response.ETag],
            ["last-modified", response.LastModified?.toUTCString()],
            ["cache-control", response.CacheControl],
            ["content-range", response.ContentRange],
            ["accept-ranges", response.AcceptRanges]
          ] as [string, string | undefined][]
        ).filter(([, v]) => v !== undefined)
      ) as Record<string, string>;

      const stream = statusCode === 304 ? null : (response.Body as unknown as Readable);
      return {stream, headers, statusCode};
    } catch (e: any) {
      if (e.$metadata?.httpStatusCode === 304) {
        return {stream: null, headers: {}, statusCode: 304};
      }
      throw e;
    }
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
