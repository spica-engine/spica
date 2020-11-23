import {Injectable} from "@nestjs/common";
import {Default, Validator} from "@spica-server/core/schema";
import {BaseCollection, Collection, DatabaseService, ObjectId} from "@spica-server/database";
import {PreferenceService} from "@spica-server/preference/services";
import {Bucket, BucketPreferences} from "./bucket";
import {Observable, BehaviorSubject} from "rxjs";

@Injectable()
export class BucketService extends BaseCollection<Bucket>("buckets") {
  readonly buckets: Collection<Bucket>;
  schemaChangeEmitter: BehaviorSubject<any> = new BehaviorSubject<any>(undefined);

  constructor(db: DatabaseService, private pref: PreferenceService, private validator: Validator) {
    super(db);
    this.buckets = db.collection("buckets");
  }

  getPreferences() {
    return this.pref.get<BucketPreferences>("bucket");
  }

  emitSchemaChanges() {
    this.schemaChangeEmitter.next(undefined);
  }

  async insertOne(bucket: Bucket) {
    const insertedBucket = await this.buckets.insertOne(bucket).then(t => t.ops[0]);
    const bucketCollection = await this.db.createCollection(`bucket_${insertedBucket._id}`);

    const indexDefinitions = this.createUniqueIndexDefs(bucket);
    for (const definition of indexDefinitions) {
      await bucketCollection.createIndex(definition, {unique: true});
    }
    return insertedBucket;
  }

  watch(bucketId: string, propagateOnStart: boolean): Observable<Bucket> {
    return new Observable(observer => {
      if (propagateOnStart) {
        this.buckets.findOne({_id: new ObjectId(bucketId)}).then(bucket => observer.next(bucket));
      }
      const stream = this.buckets.watch(
        [
          {
            $match: {
              "fullDocument._id": {$eq: new ObjectId(bucketId)}
            }
          }
        ],
        {
          fullDocument: "updateLookup"
        }
      );
      stream.on("change", change => observer.next(change.fullDocument));
      return () => {
        if (!stream.isClosed()) {
          stream.close();
        }
      };
    });
  }

  watchPreferences(propagateOnStart: boolean): Observable<BucketPreferences> {
    return this.pref.watch("bucket", {propagateOnStart});
  }

  getPredefinedDefaults(): Default[] {
    return this.validator.defaults;
  }

  createUniqueIndexDefs(bucket: Bucket) {
    const indexDefinitions = [];
    for (const [name, definition] of Object.entries(bucket.properties)) {
      if (definition.options && definition.options.unique) {
        indexDefinitions.push({[name]: 1});
      }
    }
    return indexDefinitions;
  }
}
