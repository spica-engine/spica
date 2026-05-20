export interface FunctionAssetStorageOptions {
  strategy: "default" | "awss3" | "gcs";

  // default (disk) strategy
  defaultPath?: string;

  // AWS S3 strategy
  awss3CredentialsPath?: string;
  awss3BucketName?: string;

  // Google Cloud Storage strategy
  gcsServiceAccountPath?: string;
  gcsBucketName?: string;
}

export const FUNCTION_ASSET_STORAGE_OPTIONS = Symbol.for("FUNCTION_ASSET_STORAGE_OPTIONS");
