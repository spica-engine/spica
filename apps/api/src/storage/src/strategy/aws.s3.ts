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
import {Server, EVENTS} from "@tus/server";
import {S3Store} from "@tus/s3-store";
import {CronJob} from "cron";
import {StorageObjectMeta} from "@spica-server/interface/storage";
import {Observable, Subject} from "rxjs";

export class AWSS3 implements Strategy {
  s3: S3Client;

  private tusServer: Server;
  private resumableUploadFinishedSubject = new Subject<StorageObjectMeta>();

  constructor(
    private credentialsPath: string,
    private bucketName: string,
    private resumableUploadExpiresIn: number
  ) {
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

  get resumableUploadFinished(): Observable<StorageObjectMeta> {
    return this.resumableUploadFinishedSubject.asObservable();
  }

  private initializeTusServer() {
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

    this.tusServer = new Server({
      path: "/storage/resumable",
      datastore
    });

    this.setupUploadFinishedHandler();

    new CronJob(
      "0 0 * * *",
      () => {
        this.tusServer.cleanUpExpiredUploads();
      },
      null,
      true
    );
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

  handleResumableUpload(req: any, res: any) {
    return this.tusServer.handle(req, res);
  }

  private setupUploadFinishedHandler() {
    this.tusServer.on(EVENTS.POST_FINISH, async event => {
      const fileId = event.url.split("/").pop();

      const info = await this.tusServer.datastore.getUpload(fileId);
      const filename = info.metadata.filename;

      await this.rename(fileId, filename);

      const document = {
        name: filename,
        content: {
          type: info.metadata.filetype,
          size: info.size
        }
      };
      this.resumableUploadFinishedSubject.next(document);
    });
  }
}
