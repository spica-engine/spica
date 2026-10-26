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
