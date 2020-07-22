export const STORAGE_OPTIONS = Symbol.for("STORAGE_OPTIONS");

export interface StorageOptions {
  strategy: "default" | "gcloud";
  defaultPath?: string;
  defaultPublicUrl?: string;
  gcloudServiceAccountPath?: string;
  gcloudBucketName?: string;
  objectSizeLimit: number;
}
