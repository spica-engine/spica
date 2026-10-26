import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Bucket, BucketDocument} from "@spica-server/interface-bucket";

export function bucketDataCollectionName(bucketId: {toString(): string}) {
  return `bucket_${bucketId}`;
}

async function totalBucketDataCount(db: DatabaseService) {
  const bucketNames = await db
    .collection("buckets")
    .find()
    .toArray()
    .then(buckets => buckets.map(b => bucketDataCollectionName(b._id)));

  let totalDocumentCount = 0;
  await Promise.all(
    bucketNames.map(name =>
      db
        .collection(name)
        .estimatedDocumentCount()
        .then(c => (totalDocumentCount += c))
    )
  );
  return totalDocumentCount;
}

export function bucketDataStatus(db: DatabaseService, bucketDataLimit?: number) {
  return totalBucketDataCount(db).then(current => ({
    limit: bucketDataLimit,
    current,
    unit: "count" as const
  }));
}

/**
 * The bucket's data collection, rejecting inserts beyond the bucket's count limit and the total
 * bucket data limit.
 */
export function bucketDataCollection(
  db: DatabaseService,
  bucket: Bucket,
  bucketDataLimit?: number
) {
  const Collection = BaseCollection<BucketDocument>(bucketDataCollectionName(bucket._id));
  const options: {entryLimit?: number} = {};

  if (bucket.documentSettings && bucket.documentSettings.countLimit) {
    options.entryLimit = bucket.documentSettings.countLimit;
  }

  const collection = new Collection(db, options);
  if (!bucketDataLimit) {
    return collection;
  }

  const validateTotalCount = async (count: number) => {
    if ((await totalBucketDataCount(db)) + count > bucketDataLimit) {
      throw new Error("Total bucket-data limit exceeded");
    }
  };

  const insertOne = collection.insertOne;
  collection.insertOne = async doc => {
    await validateTotalCount(1);
    return insertOne.bind(collection)(doc);
  };

  const insertMany = collection.insertMany;
  collection.insertMany = async docs => {
    await validateTotalCount(docs.length);
    return insertMany.bind(collection)(docs);
  };

  return collection;
}
