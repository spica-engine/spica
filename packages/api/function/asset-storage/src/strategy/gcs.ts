import {Storage, Bucket} from "@google-cloud/storage";
import {FunctionAssetStrategy} from "@spica-server/interface-function-asset-storage";

export class GCSStrategy implements FunctionAssetStrategy {
  private readonly storage: Storage;
  private readonly bucket: Bucket;

  constructor(serviceAccountPath: string, bucketName: string, storage?: Storage) {
    if (storage) {
      this.storage = storage;
    } else {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = serviceAccountPath;
      this.storage = new Storage();
    }
    this.bucket = this.storage.bucket(bucketName);
  }

  async read(key: string): Promise<Buffer> {
    const [data] = await this.bucket.file(key).download();
    return Buffer.from(data);
  }

  async write(key: string, data: Buffer): Promise<void> {
    await this.bucket.file(key).save(data);
  }

  async delete(key: string): Promise<void> {
    await this.bucket
      .file(key)
      .delete()
      .catch(e => {
        if (e.code !== 404) throw e;
      });
  }

  async exists(key: string): Promise<boolean> {
    const [exists] = await this.bucket.file(key).exists();
    return exists;
  }
}
