import {ObjectId} from "@spica-server/database";

export type FunctionAssetFilename = "index.ts" | "index.js" | "package.json";

export const FUNCTION_ASSET_FILENAMES: FunctionAssetFilename[] = [
  "index.ts",
  "index.js",
  "package.json"
];

export interface FunctionAsset {
  _id?: ObjectId;
  functionId: ObjectId;
  filename: FunctionAssetFilename;
  key: string;
  hash: string;
  size: number;
  uploadDate: Date;
  strategy: string;
}
