import {ObjectId} from "@spica-server/database";

export type FunctionAssetFilename = "index.ts" | "index.mjs" | "package.json" | "package-lock.json";

export const FUNCTION_ASSET_FILENAMES: FunctionAssetFilename[] = [
  "index.ts",
  "index.mjs",
  "package.json",
  "package-lock.json"
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

export interface FunctionArtifactInputs {
  index: string | null;
  packageJson: string | null;
  lockfile: string | null;
  builder: string;
}

export interface FunctionArtifact {
  _id?: ObjectId;
  functionId: ObjectId;
  platform: string;
  key: string | null;
  inputs: FunctionArtifactInputs;
  uploadDate: Date;
}
