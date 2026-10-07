export interface StoredObject {
  key: string;
  lastModified: Date;
}

export interface FunctionAssetStrategy {
  read(key: string): Promise<Buffer>;
  write(key: string, data: Buffer): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  upload(key: string, filePath: string): Promise<void>;
  download(key: string, filePath: string): Promise<void>;
  list(prefix: string): Promise<StoredObject[]>;
}

export const FUNCTION_ASSET_STRATEGY = Symbol.for("FUNCTION_ASSET_STRATEGY");
