import {ReadStream} from "fs";
import {Readable} from "stream";
import {Storage, Bucket} from "@google-cloud/storage";
import {GCSStore} from "@tus/gcs-store";
import {BaseStrategy} from "./base-strategy.js";
import {ProxyReadResult} from "./strategy.js";
import {StorageObjectMeta} from "@spica-server/interface-storage";
import {Logger} from "@nestjs/common";

export class GCloud extends BaseStrategy {
  private readonly logger = new Logger(GCloud.name);
  private storage: Storage;
  private bucket: Bucket;

  constructor(serviceAccountPath: string, bucketName: string, resumableUploadExpiresIn: number) {
    super(resumableUploadExpiresIn);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;
    this.storage = new Storage();
    this.bucket = this.storage.bucket(bucketName);

    this.initializeTusServer();
  }

  protected initializeTusServer() {
    const datastore = new GCSStore({bucket: this.bucket});
    super.initializeTusServer(datastore);
  }

  protected cleanUpExpiredUploads() {
    return this.cleanUpExpiredUploadsGCS();
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
        this.logger.error(
          err instanceof Error ? err.message : String(err),
          err instanceof Error ? err.stack : ""
        );
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

  async delete(id: string) {
    await this.bucket.deleteFiles({prefix: id});
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

  async proxyRead(
    id: string,
    requestHeaders: Record<string, string>,
    _meta: StorageObjectMeta
  ): Promise<ProxyReadResult> {
    const file = this.bucket.file(id);
    const metadata = await this.getMetadata(id);

    const responseHeaders = Object.fromEntries(
      (
        [
          ["content-type", metadata.contentType],
          ["etag", metadata.etag],
          ["last-modified", metadata.updated ? new Date(metadata.updated).toUTCString() : undefined],
          ["cache-control", metadata.cacheControl ?? "public, max-age=3600, must-revalidate"],
          ["accept-ranges", "bytes"]
        ] as [string, string | undefined][]
      ).filter(([, v]) => v !== undefined)
    ) as Record<string, string>;

    if (
      requestHeaders["if-none-match"] &&
      requestHeaders["if-none-match"] === metadata.etag
    ) {
      return {stream: null, headers: responseHeaders, statusCode: 304};
    }

    let streamOptions: {start?: number; end?: number} = {};
    let statusCode = 200;
    const fileSize = Number(metadata.size ?? 0);

    if (requestHeaders["range"]) {
      const match = requestHeaders["range"].match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
        streamOptions = {start, end};
        statusCode = 206;
        responseHeaders["content-range"] = `bytes ${start}-${end}/${fileSize}`;
        responseHeaders["content-length"] = String(end - start + 1);
      }
    } else if (fileSize > 0) {
      responseHeaders["content-length"] = String(fileSize);
    }

    const stream = file.createReadStream(streamOptions) as unknown as Readable;
    return {stream, headers: responseHeaders, statusCode};
  }

  async rename(oldName: string, newName: string): Promise<void> {
    const [files] = await this.bucket.getFiles({prefix: oldName});

    await Promise.all(
      files.map(async file => {
        const newDir = file.name.replace(oldName, newName);
        await file.move(newDir);
      })
    );
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

  async cleanUpExpiredUploadsGCS() {
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
