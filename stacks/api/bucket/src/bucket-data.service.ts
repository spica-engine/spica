import {Injectable} from "@nestjs/common";
import {BucketDocument} from "@spica-server/bucket/services";
import {
  DatabaseService,
  DeleteWriteOpResultObject,
  FilterQuery,
  FindAndModifyWriteOpResultObject,
  FindOneAndReplaceOption,
  InsertOneWriteOpResult,
  InsertWriteOpResult,
  ObjectId,
  UpdateQuery,
  UpdateOneOptions,
  FindOneAndUpdateOption
} from "@spica-server/database";

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

  replaceOne(
    bucketId: ObjectId,
    filter: FilterQuery<BucketDocument>,
    document: BucketDocument,
    options: FindOneAndReplaceOption
  ): Promise<FindAndModifyWriteOpResultObject> {
    const collection = this.db.collection(getBucketDataCollection(bucketId));
    return collection.findOneAndReplace(filter, document, options);
  }

  deleteOne(
    bucketId: string | ObjectId,
    filter: FilterQuery<BucketDocument>
  ): Promise<DeleteWriteOpResultObject> {
    const collection = this.db.collection(getBucketDataCollection(bucketId));
    return collection.deleteOne(filter, {});
  }

  deleteAll(bucketId: string | ObjectId): Promise<boolean> {
    return this.db.collection(getBucketDataCollection(bucketId)).drop();
  }

  deleteMany(
    bucketId: string | ObjectId,
    idArray: Array<string | ObjectId>
  ): Promise<DeleteWriteOpResultObject> {
    const collection = this.db.collection(getBucketDataCollection(bucketId));

    return collection.deleteMany({_id: {$in: idArray.map(data => new ObjectId(data))}});
  }

  updateMany(bucketId: ObjectId, filter: FilterQuery<any>, update: any) {
    const collection = this.db.collection(getBucketDataCollection(bucketId));
    return collection.updateMany(filter, update);
  }

  updateOne<T = unknown>(bucketId: ObjectId, filter: FilterQuery<T>, update: UpdateQuery<T>) {
    const collection = this.db.collection(getBucketDataCollection(bucketId));
    return collection.updateOne(filter, update);
  }

  findOneAndUpdate<T = unknown>(
    bucketId: ObjectId,
    filter: FilterQuery<T>,
    update: T | UpdateQuery<T>,
    options?: FindOneAndUpdateOption
  ): Promise<T> {
    const collection = this.db.collection(getBucketDataCollection(bucketId));
    return collection.findOneAndUpdate(filter, update, options).then(r => r.value);
  }
}

export function getBucketDataCollection(bucketId: string | ObjectId): string {
  return `bucket_${bucketId}`;
}
