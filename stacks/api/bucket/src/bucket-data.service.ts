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
  UpdateQuery
} from "@spica-server/database";
import {PreferenceService} from "@spica-server/preference/services";
import {diff, ChangeKind} from "../history/differ";
import {filterTranslatableBucketsAggregation} from "./utility";

@Injectable()
export class BucketDataService {
  constructor(private db: DatabaseService, private preferenceService: PreferenceService) {
    //find a better starting point
    this.removeDataOnLanguageRemoved();
  }

  private removeDataOnLanguageRemoved() {
    let oldPrefs = {};
    let initialState = true;
    this.preferenceService.watch("bucket", {propagateOnStart: true}).subscribe(newPrefs => {
      if (initialState) {
        oldPrefs = newPrefs;
        initialState = false;
        return;
      }

      let changes = diff(oldPrefs, newPrefs as any);
      let deletedLanguages = changes
        .filter(
          change =>
            change.kind == ChangeKind.Delete &&
            change.path[0] == "language" &&
            change.path[1] == "available"
        )
        .map(change => change.path[2]);

      if (!deletedLanguages.length) {
        oldPrefs = newPrefs;
        return;
      }

      this.db
        .collection("buckets")
        .aggregate(filterTranslatableBucketsAggregation())
        .toArray()
        .then(buckets => {
          buckets.forEach(bucket => {
            let targets = {};

            Object.keys(bucket.properties).forEach(field => {
              targets = deletedLanguages.reduce((acc, language) => {
                acc = {...acc, [`${field}.${language}`]: ""};
                return acc;
              }, targets);
            });

            this.updateMany(bucket._id, {}, {$unset: targets}).catch(console.log);
          });
        });

      oldPrefs = newPrefs;
    });
  }

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
}

export function getBucketDataCollection(bucketId: string | ObjectId): string {
  return `bucket_${bucketId}`;
}
