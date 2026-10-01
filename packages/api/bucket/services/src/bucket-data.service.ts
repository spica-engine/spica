import {Inject, Injectable, Optional} from "@nestjs/common";
import {BaseCollection, DatabaseService, getCollection, ObjectId} from "@spica-server/database";
import {Bucket, BucketDocument, BUCKET_DATA_LIMIT} from "@spica-server/interface-bucket";

@Injectable()
export class BucketDataService {
  constructor(
    private db: DatabaseService,
    @Optional() @Inject(BUCKET_DATA_LIMIT) private bucketDataLimit
  ) {}

  children(schema: Bucket) {
    const Collection = BaseCollection<BucketDocument>(getBucketDataCollection(schema._id));
    let options: any = {};

    if (schema.documentSettings && schema.documentSettings.countLimit) {
      options.entryLimit = schema.documentSettings.countLimit;
    }

    const collection = new Collection(this.db, options);
    if (!this.bucketDataLimit) {
      return collection;
    }

    const insertOne = collection.insertOne;
    collection.insertOne = async doc => {
      await this.validateTotalBucketDataCount(1);
      return insertOne.bind(collection)(doc);
    };

    const insertMany = collection.insertMany;
    collection.insertMany = async docs => {
      await this.validateTotalBucketDataCount(docs.length);
      return insertMany.bind(collection)(docs);
    };

    return collection;
  }

  private async existingBucketData() {
    const bucketNames = await getCollection(this.db, "buckets")
      .find()
      .then(buckets => buckets.map(b => `bucket_${b._id}`));

    let totalDocumentCount = 0;

    return Promise.all(
      bucketNames.map(name =>
        getCollection(this.db, name)
          .estimatedDocumentCount()
          .then(c => (totalDocumentCount += c))
      )
    ).then(() => totalDocumentCount);
  }

  async getStatus() {
    return {
      limit: this.bucketDataLimit,
      current: await this.existingBucketData(),
      unit: "count"
    };
  }

  private async validateTotalBucketDataCount(count: number) {
    const totalDocumentCount = await this.existingBucketData();
    if (totalDocumentCount + count > this.bucketDataLimit) {
      throw new Error("Total bucket-data limit exceeded");
    }
  }
}

export function getBucketDataCollection(bucketId: string | ObjectId): string {
  return `bucket_${bucketId}`;
}

/**
 * The inverse of `getBucketDataCollection`; `undefined` for names that are not a bucket data collection.
 *
 * The PostgreSQL driver's schema resolver takes a collection **name**, not a bucket id.
 */
export function bucketIdFromCollection(collection: string): string | undefined {
  const match = /^bucket_([0-9a-fA-F]{24})$/.exec(collection);
  return match ? match[1] : undefined;
}
