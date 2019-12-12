import {Injectable} from "@nestjs/common";
import {
  DatabaseService,
  InsertOneWriteOpResult,
  ReplaceWriteOpResult,
  InsertWriteOpResult,
  DeleteWriteOpResultObject,
  FilterQuery,
  ObjectId
} from "@spica-server/database";
import {BucketDocument} from "./bucket";

@Injectable()
export class BucketDataService {
  constructor(private db: DatabaseService) {}

  documentCount(bucketId: string | ObjectId) {
    const collection = this.db.collection(getBucketDataCollection(bucketId));
    return collection.estimatedDocumentCount();
  }

  find<T = BucketDocument>(bucketId: string | ObjectId, aggregate?: any): Promise<Array<T>> {
    const collection = this.db.collection(getBucketDataCollection(bucketId));
    return collection.aggregate(aggregate).toArray();
  }

  findOne<T = BucketDocument, F = any>(
    bucketId: string | ObjectId,
    filter?: FilterQuery<F>
  ): Promise<T | undefined> {
    const collection = this.db.collection(getBucketDataCollection(bucketId));
    return collection.findOne(filter);
  }

  insertMany(bucketId: string | ObjectId, data: any[]): Promise<InsertWriteOpResult> {
    const collection = this.db.collection(getBucketDataCollection(bucketId));
    return collection.insertMany(data);
  }

  insertOne(bucketId: string | ObjectId, data: any): Promise<InsertOneWriteOpResult> {
    const collection = this.db.collection(getBucketDataCollection(bucketId));
    return collection.insertOne(data);
  }

  replaceOne<D extends BucketDocument>(
    bucketId: string | ObjectId,
    data: D
  ): Promise<ReplaceWriteOpResult>;
  replaceOne<D extends BucketDocument>(
    bucketId: string | ObjectId,
    data: D,
    filter: FilterQuery<D>
  ): Promise<ReplaceWriteOpResult>;
  replaceOne(
    bucketId: string,
    data: BucketDocument,
    filter?: FilterQuery<BucketDocument>
  ): Promise<ReplaceWriteOpResult> {
    const collection = this.db.collection(getBucketDataCollection(bucketId));
    if (!filter && data._id) {
      filter = {_id: data._id};
    } else if (!filter && !data._id) {
      filter = {_id: new ObjectId()};
    }
    return collection.replaceOne(filter, data, {
      upsert: true
    });
  }

  deleteOne(
    bucketId: string | ObjectId,
    filter: FilterQuery<BucketDocument>
  ): Promise<DeleteWriteOpResultObject> {
    const collection = this.db.collection(getBucketDataCollection(bucketId));
    return collection.deleteOne(filter);
  }

  deleteAll(bucketId: string | ObjectId): Promise<boolean> {
    return this.db.collection(getBucketDataCollection(bucketId)).drop();
  }

  deleteMany(
    bucketId: string | ObjectId,
    idArray: Array<string>
  ): Promise<DeleteWriteOpResultObject> {
    const collection = this.db.collection(getBucketDataCollection(bucketId));

    return collection.deleteMany({_id: {$in: idArray.map(data => new ObjectId(data))}});
  }

  updateMany(bucketId: ObjectId, filter: FilterQuery<any>, update: any) {
    const collection = this.db.collection(getBucketDataCollection(bucketId));
    return collection.updateMany(filter, update);
  }
}

export function getBucketDataCollection(bucketId: string | ObjectId): string {
  return `bucket_${bucketId}`;
}
