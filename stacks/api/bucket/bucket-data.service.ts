import {Injectable} from "@nestjs/common";
import {
  DatabaseService,
  InsertOneWriteOpResult,
  InsertWriteOpResult,
  DeleteWriteOpResultObject,
  FilterQuery,
  ObjectId,
  FindAndModifyWriteOpResultObject
} from "@spica-server/database";
import {BucketDocument} from "@spica-server/bucket/services";

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
    documentId: ObjectId,
    document: BucketDocument
  ): Promise<FindAndModifyWriteOpResultObject> {
    const collection = this.db.collection(getBucketDataCollection(bucketId));
    return collection.findOneAndReplace({_id: documentId}, document, {returnOriginal: false});
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

  updateOne(bucketId: ObjectId, documentId: ObjectId, update: any) {
    const collection = this.db.collection(getBucketDataCollection(bucketId));
    return collection.updateOne({_id: documentId}, {$set: update});
  }
}

export function getBucketDataCollection(bucketId: string | ObjectId): string {
  return `bucket_${bucketId}`;
}
