import {Id} from "@spica-server/interface-data";

export type FunctionAssetFilename = "index.ts" | "index.mjs" | "package.json" | "package-lock.json";

export const FUNCTION_ASSET_FILENAMES: FunctionAssetFilename[] = [
  "index.ts",
  "index.mjs",
  "package.json",
  "package-lock.json"
];

export interface FunctionAsset {
  _id?: Id;
  functionId: Id;
  filename: FunctionAssetFilename;
  key: string;
  hash: string;
  size: number;
  uploadDate: Date;
  strategy: string;
}

export interface FunctionAssetRepository {
  findByFunction(functionId: Id): Promise<FunctionAsset[]>;
  findByFilename(functionId: Id, filename: FunctionAssetFilename): Promise<FunctionAsset | null>;
  upsertAsset(
    functionId: Id,
    filename: FunctionAssetFilename,
    fields: Omit<FunctionAsset, "functionId" | "filename" | "_id">
  ): Promise<void>;
  upsertMany(
    functionId: Id,
    assets: Array<Omit<FunctionAsset, "functionId" | "_id">>
  ): Promise<void>;
  /**
   * Moves the asset's key only when it still is `from`, resolving to whether it moved.
   */
  replaceKey(
    functionId: Id,
    filename: FunctionAssetFilename,
    from: string,
    to: string
  ): Promise<boolean>;
  deleteByFunction(functionId: Id): Promise<number>;
}

export const FUNCTION_ASSET_REPOSITORY = Symbol.for("FUNCTION_ASSET_REPOSITORY");
export const FUNCTION_ASSET_COLLECTION = "function_assets";
