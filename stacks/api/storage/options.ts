export const STORAGE_OPTIONS = "STORAGE_OPTIONS";

export interface StorageOptions {
  path: string;
  publicUrl: string;
  service: string;
  serviceAccountPath?: string;
  bucketName?: string;
}
