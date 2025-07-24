import {ReadStream} from "fs";

export abstract class Strategy {
  abstract read(id: string): Promise<Buffer>;
  abstract write(id: string, data: Buffer, mimeType?: string): Promise<void>;
  abstract writeStream(id: string, data: ReadStream, mimeType?: string): Promise<void>;
  abstract delete(id: string): Promise<void> | void;
  abstract url(id: string): Promise<string>;
  abstract rename(oldKey: string, newKey: string): Promise<void>;
  abstract getTusServerDatastore(): any;
}
