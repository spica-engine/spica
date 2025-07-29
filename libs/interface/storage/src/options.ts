export interface StorageOptions {
  strategy: "default" | "gcloud" | "awss3";
  defaultPath?: string;
  defaultPublicUrl?: string;
  gcloudServiceAccountPath?: string;
  gcloudBucketName?: string;
  awss3CredentialsPath?: string;
  awss3BucketName?: string;
  objectSizeLimit: number;
  totalSizeLimit?: number;
  expirationPeriod: number;
}

export const STORAGE_OPTIONS = Symbol.for("STORAGE_OPTIONS");
