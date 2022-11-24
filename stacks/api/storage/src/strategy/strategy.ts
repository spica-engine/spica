export abstract class Strategy {
  abstract read(id: string): Promise<Buffer>;
  abstract write(id: string, data: Buffer, mimeType?: string): Promise<void>;
  abstract delete(id: string): Promise<void> | void;
}
