import {Inject, Injectable, Optional} from "@nestjs/common";
import {Default, Validator} from "@spica-server/core/schema";
import {
  BaseCollection,
  Collection,
  DatabaseService,
  IndexOptions,
  ObjectId
} from "@spica-server/database";
import {PreferenceService} from "@spica-server/preference/services";
import {BehaviorSubject, Observable} from "rxjs";
import {Bucket, BucketPreferences} from "./bucket";
import {getBucketDataCollection} from "@spica-server/bucket/services";
import {BUCKET_DATA_LIMIT} from "./options";

export interface IndexDefinition {
  definition: {
    [key: string]: 1 | -1;
  };
  options?: IndexOptions;
}

interface ExistingIndex {
  v: number;
  key: {
    [key: string]: 1 | -1;
  };
  name: string;
}

@Injectable()
export class BucketService extends BaseCollection<Bucket>("buckets") {
  readonly buckets: Collection<Bucket>;
  schemaChangeEmitter: BehaviorSubject<any> = new BehaviorSubject<any>(undefined);

  constructor(
    db: DatabaseService,
    private pref: PreferenceService,
    private validator: Validator,
    @Optional() @Inject(BUCKET_DATA_LIMIT) private bucketDataLimit
  ) {
    super(db);
    this.buckets = db.collection("buckets");
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

    await this.updateIndexes(bucket);

    return insertedBucket;
  }

  async updateIndexes(bucket: Bucket) {
    const indexDefinitions = this.createIndexDefinitions(bucket);
    const indexesWillDrop = [];

    for (const index of await this.getIndexesWillBeDropped()) {
      indexesWillDrop.push(this._coll.dropIndex(index));
    }

    await Promise.all(indexesWillDrop);
    await Promise.all(
      indexDefinitions.map(index => this._coll.createIndex(index.definition, index.options))
    );
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

  createIndexDefinitions(bucket: Bucket): IndexDefinition[] {
    const indexDefinitions: IndexDefinition[] = [];

    for (const [name, definition] of Object.entries(bucket.properties)) {
      if (definition.options) {
        if (definition.options.index) {
          const direction = definition.options.index;
          indexDefinitions.push({definition: {[name]: direction}});
        } else if (definition.options.unique) {
          indexDefinitions.push({definition: {[name]: 1}, options: {unique: true}});
        }
      }
    }

    return indexDefinitions;
  }

  async getIndexesWillBeDropped(): Promise<string[]> {
    const existings: ExistingIndex[] = await this._coll.listIndexes().toArray();
    return existings
      .filter(existing => this.isSingleFieldIndex(existing))
      .map(existing => existing.name);
  }

  isSingleFieldIndex(index: ExistingIndex) {
    const keys = Object.keys(index.key);
    // we can not remove _id index since it's default index of mongodb
    return keys.length == 1 && keys[0] != "_id";
  }

  collNameToId(collName: string) {
    return collName.startsWith("bucket_") ? collName.replace("bucket_", "") : undefined;
  }
}
