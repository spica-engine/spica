import {Inject, Injectable, Optional} from "@nestjs/common";
import {Default, Validator} from "@spica-server/core/schema";
import {BaseCollection, Collection, DatabaseService, ObjectId} from "@spica-server/database";
import {PreferenceService} from "@spica-server/preference/services";
import {BehaviorSubject, Observable} from "rxjs";
import {Bucket, BucketPreferences} from "./bucket";
import {getBucketDataCollection} from "@spica-server/bucket/services";
import {BUCKET_DATA_LIMIT} from "./options";

@Injectable()
export class BucketService extends BaseCollection<Bucket>("buckets") {
  schemaChangeEmitter: BehaviorSubject<any> = new BehaviorSubject<any>(undefined);

  constructor(
    db: DatabaseService,
    private pref: PreferenceService,
    private validator: Validator,
    @Optional() @Inject(BUCKET_DATA_LIMIT) private bucketDataLimit
  ) {
    super(db);
  }

  getPreferences() {
    return this.pref.get<BucketPreferences>("bucket");
  }

  emitSchemaChanges() {
    this.schemaChangeEmitter.next(undefined);
  }

  async totalDocCountValidation(count: number) {
    if (!this.bucketDataLimit) {
      return;
    }

    const existing = await super
      .aggregate([
        {
          $group: {
            _id: "",
            total: {
              $sum: "$documentSettings.countLimit"
            }
          }
        },
        {
          $project: {
            total: 1
          }
        }
      ])
      .toArray()
      .then((d: any[]) => (d.length ? d[0].total : 0));

    if (existing + count > this.bucketDataLimit) {
      throw new Error(`Remained document count limit is ${this.bucketDataLimit - existing}`);
    }
  }

  async insertOne(bucket: Bucket) {
    await this.totalDocCountValidation(
      bucket.documentSettings ? bucket.documentSettings.countLimit : 0
    );

    const insertedBucket = await super.insertOne(bucket);
    const bucketCollection = await this.db.createCollection(
      getBucketDataCollection(insertedBucket._id)
    );

    const indexDefinitions = this.createUniqueIndexDefs(bucket);
    for (const definition of indexDefinitions) {
      await bucketCollection.createIndex(definition, {unique: true});
    }
    return insertedBucket;
  }

  async updateUniqueFields(id: string | ObjectId, newSchema: Bucket) {
    const collection = this.db.collection(getBucketDataCollection(id));

    const indexes = await collection
      .listIndexes()
      .toArray()
      .then(indexes => indexes.filter(i => i.unique).map(i => Object.keys(i.key)[0]));

    const newIndexes = this.getUniqueFields(newSchema);

    for (const index of indexes) {
      if (newIndexes.indexOf(index) == -1) {
        await collection.dropIndex({[index]: 1} as any);
      }
    }
  }

  async drop(id: string | ObjectId) {
    const schema = await super.findOneAndDelete({_id: new ObjectId(id)});
    await this.db.dropCollection(getBucketDataCollection(id));
    return schema;
  }

  watch(bucketId: string, propagateOnStart: boolean): Observable<Bucket> {
    return new Observable(observer => {
      if (propagateOnStart) {
        super.findOne({_id: new ObjectId(bucketId)}).then(bucket => observer.next(bucket));
      }
      const stream = this._coll.watch(
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
    return this.getUniqueFields(bucket).map(field => {
      return {
        [field]: 1
      };
    });
  }

  getUniqueFields(bucket: Bucket) {
    const fields = [];
    for (const [name, definition] of Object.entries(bucket.properties)) {
      if (definition.options && definition.options.unique) {
        fields.push(name);
      }
    }
    return fields;
  }

  collNameToId(collName: string) {
    return collName.startsWith("bucket_") ? collName.replace("bucket_", "") : undefined;
  }
}
