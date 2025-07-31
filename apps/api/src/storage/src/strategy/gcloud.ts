import {ReadStream} from "fs";
import {Strategy} from "./strategy";
import {Storage, Bucket} from "@google-cloud/storage";
import {Server, EVENTS} from "@tus/server";
import {GCSStore} from "@tus/gcs-store";
import {CronJob} from "cron";
import {StorageObjectMeta} from "@spica-server/interface/storage";
import {Observable, Subject} from "rxjs";

export class GCloud implements Strategy {
  private storage: Storage;
  private bucket: Bucket;

  private tusServer: Server;
  private resumableUploadFinishedSubject = new Subject<StorageObjectMeta>();

  constructor(
    serviceAccountPath: string,
    bucketName: string,
    private resumableUploadExpiresIn: number
  ) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;
    this.storage = new Storage();
    this.bucket = this.storage.bucket(bucketName);

    this.initializeTusServer();
  }

  get resumableUploadFinished(): Observable<StorageObjectMeta> {
    return this.resumableUploadFinishedSubject.asObservable();
  }

  private initializeTusServer() {
    this.tusServer = new Server({
      path: "/storage/resumable",
      datastore: new GCSStore({bucket: this.bucket})
    });

    this.setupUploadFinishedHandler();

    new CronJob(
      "0 0 * * *",
      () => {
        this.cleanUpExpiredUploads();
      },
      null,
      true
    );
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

  async getMetadata(id: string) {
    const [res] = await this.bucket.file(id).getMetadata();
    return res;
  }

  url(id: string) {
    return this.getMetadata(id).then(res => {
      const url = new URL(res.mediaLink);
      url.searchParams.delete("generation");
      return url.toString();
    });
  }

  async rename(oldName: string, newName: string): Promise<void> {
    const file = this.bucket.file(oldName);
    await file.move(newName);
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

  async getAllFilesMetadataPaginated(pageToken?: string): Promise<{
    files: Array<{name: string; metadata: any}>;
    nextPageToken?: string;
  }> {
    const options: any = {maxResults: 100, autoPaginate: false};

    if (pageToken) {
      options.pageToken = pageToken;
    }

    const [files, , response] = await this.bucket.getFiles(options);

    const metadataList = await Promise.all(
      files.map(async file => {
        const [metadata] = await file.getMetadata();

        return {name: file.name, metadata};
      })
    );

    return {files: metadataList, nextPageToken: (response as any)?.nextPageToken};
  }

  isValidHex32(id: string): boolean {
    return /^[0-9a-f]{32}$/i.test(id);
  }

  async cleanUpExpiredUploads() {
    let pageToken: string | undefined;

    let count = 0;

    do {
      const {files, nextPageToken} = await this.getAllFilesMetadataPaginated(pageToken);

      files.forEach(file => {
        const isUploadedWithTus = !!file.metadata.metadata?.tus_version;
        if (!isUploadedWithTus) return;

        const isValidHex = this.isValidHex32(file.name);
        if (!isValidHex) return;

        const createdTime = new Date(file.metadata.timeCreated);
        const now = new Date();
        const diffMs = now.getTime() - createdTime.getTime();

        const isExpired = diffMs >= this.resumableUploadExpiresIn;
        if (!isExpired) return;

        this.delete(file.name);
        count++;
      });

      pageToken = nextPageToken;
    } while (pageToken);

    return count;
  }
}
