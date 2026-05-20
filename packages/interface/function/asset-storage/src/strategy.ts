export interface FunctionAssetStrategy {
  read(key: string): Promise<Buffer>;
  write(key: string, data: Buffer): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export const FUNCTION_ASSET_STRATEGY = Symbol.for("FUNCTION_ASSET_STRATEGY");
