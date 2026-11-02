import {Inject, Injectable} from "@nestjs/common";
import {Id} from "@spica-server/interface-data";
import {
  Bucket,
  BUCKET_DATA_REPOSITORY,
  BUCKET_REPOSITORY,
  BucketDataRepository,
  BucketRepository,
  BucketSchemaManager,
  StoredBucket
} from "@spica-server/interface-bucket";

@Injectable()
export class MongoBucketSchemaManager implements BucketSchemaManager {
  constructor(
    @Inject(BUCKET_REPOSITORY) private buckets: BucketRepository,
    @Inject(BUCKET_DATA_REPOSITORY) private bucketData: BucketDataRepository
  ) {}

  async create(bucket: Bucket, onSaved: (saved: StoredBucket) => void) {
    const inserted = await this.buckets.insert(bucket);
    onSaved(inserted);
    await this.bucketData.createStorage(inserted);
    await this.bucketData.syncIndexes(bucket);
    return inserted;
  }

  async replace(id: Id, bucket: Bucket, onSaved: (saved: StoredBucket) => void) {
    const result = await this.buckets.replaceById(id, bucket);
    const replaced = {...bucket, _id: id} as StoredBucket;
    onSaved(replaced);
    await this.bucketData.syncIndexes(replaced);
    return result;
  }

  async drop(id: Id, onSaved: (dropped: StoredBucket) => void) {
    const dropped = await this.buckets.deleteById(id);
    if (!dropped) {
      return null;
    }
    onSaved(dropped);
    await this.bucketData.dropStorage(dropped._id);
    return dropped;
  }
}
