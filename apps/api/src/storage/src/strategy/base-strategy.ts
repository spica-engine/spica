import {StorageObjectMeta} from "../../../../../../libs/interface/storage";
import {Server, EVENTS} from "@tus/server";
import {CronJob} from "cron";
import {Observable, Subject} from "rxjs";
import {Strategy} from "./strategy";

export abstract class BaseStrategy implements Strategy {
  protected tusServer: Server;
  protected resumableUploadFinishedSubject = new Subject<StorageObjectMeta>();

  constructor(protected resumableUploadExpiresIn: number) {}

  get resumableUploadFinished(): Observable<StorageObjectMeta> {
    return this.resumableUploadFinishedSubject.asObservable();
  }

  protected initializeTusServer(datastore: any) {
    this.tusServer = new Server({
      path: "/storage/resumable",
      datastore
    });

    this.setupUploadFinishedHandler();
    this.setupCleanupCronJob();
  }

  protected setupUploadFinishedHandler() {
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

  protected setupCleanupCronJob() {
    new CronJob(
      "0 0 * * *",
      () => {
        this.cleanUpExpiredUploads();
      },
      null,
      true
    );
  }

  protected cleanUpExpiredUploads() {
    return this.tusServer.cleanUpExpiredUploads();
  }

  handleResumableUpload(req: any, res: any) {
    return this.tusServer.handle(req, res);
  }

  // Abstract methods that must be implemented by concrete strategies
  abstract read(id: string): Promise<Buffer>;
  abstract write(id: string, data: Buffer, mimeType?: string): Promise<void>;
  abstract writeStream(id: string, data: any, mimeType?: string): Promise<void>;
  abstract delete(id: string): Promise<void> | void;
  abstract url(id: string): Promise<string>;
  abstract rename(oldKey: string, newKey: string): Promise<void>;
}
