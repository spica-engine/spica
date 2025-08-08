import {StorageObjectMeta} from "../../../../../../libs/interface/storage";
import {ReadStream} from "fs";
import {Observable} from "rxjs";

export abstract class Strategy {
  abstract read(id: string): Promise<Buffer>;
  abstract write(id: string, data: Buffer, mimeType?: string): Promise<void>;
  abstract writeStream(id: string, data: ReadStream, mimeType?: string): Promise<void>;
  abstract delete(id: string): Promise<void> | void;
  abstract url(id: string): Promise<string>;
  abstract rename(oldKey: string, newKey: string): Promise<void>;
  abstract handleResumableUpload(req: any, res: any): any;
  abstract get resumableUploadFinished(): Observable<StorageObjectMeta>;
}
