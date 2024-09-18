import {Inject, Injectable, Optional} from "@nestjs/common";
import {Default, Validator} from "@spica-server/core/schema";
import {
  BaseCollection,
  Collection,
  DatabaseService,
  Filter,
  FindOneAndReplaceOptions,
  ObjectId,
  IndexInformationOptions
} from "@spica-server/database";
import {PreferenceService} from "@spica-server/preference/services";
import {BehaviorSubject, Observable} from "rxjs";
import {Bucket, BucketPreferences} from "./bucket";
import {getBucketDataCollection} from "@spica-server/bucket/services";
import {BUCKET_DATA_LIMIT} from "./options";

export interface IndexDefinition {
  definition: {
    [key: string]: any;
  };
  options?: IndexInformationOptions;
}

interface ExistingIndex {
  v: number;
  key: {
    [key: string]: any;
  };
  name: string;
  [key: string]: any;
}

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

    await this.db.createCollection(getBucketDataCollection(insertedBucket._id));

    await this.updateIndexes(bucket);

    return insertedBucket;
  }

  findOneAndReplace(
    filter: Filter<{_id: string}>,
    doc: Bucket,
    options?: FindOneAndReplaceOptions
  ): Promise<Bucket> {
    return super
      .findOneAndReplace(filter, doc, options)
      .then(r => this.updateIndexes({...doc, _id: filter._id}).then(() => r));
  }

  async updateIndexes(bucket: Bucket): Promise<void> {
    const bucketDataCollection = this.db.collection(getBucketDataCollection(bucket._id));

    const indexDefinitions = this.createIndexDefinitions(bucket);
    const indexesWillBeDropped = [];

    const errors = [];

    const indexes = await this.getIndexesWillBeDropped(bucketDataCollection);
    for (const index of indexes) {
      indexesWillBeDropped.push(bucketDataCollection.dropIndex(index).catch(e => errors.push(e)));
    }

    await Promise.all(indexesWillBeDropped);
    await Promise.all(
      indexDefinitions.map(index =>
        bucketDataCollection.createIndex(index.definition, index.options).catch(e => errors.push(e))
      )
    );

    if (errors.length) {
      throw Error(errors.map(e => e.message).join(""));
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
        if (!stream.closed) {
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

  createIndexDefinitions(
    bucket: Bucket,
    definitions: IndexDefinition[] = [],
    prefix: string = ""
  ): IndexDefinition[] {
    const keyGenerator = (prefix, name) => {
      return prefix ? `${prefix}.${name}` : name;
    };
    for (const [name, spec] of Object.entries(bucket.properties)) {
      if (spec.options && (spec.options.index || spec.options.unique)) {
        const key = keyGenerator(prefix, name);
        definitions.push({
          // direction of index is unimportant for single field indexes
          definition: {[key]: 1},
          options: {unique: !!spec.options.unique}
        });
      }

      if (spec.type == "object") {
        const key = keyGenerator(prefix, name);

        this.createIndexDefinitions(spec as any, definitions, key);
      } else if (spec.type == "array") {
        const key = keyGenerator(prefix, name);

        const schema = {
          properties: {
            [key]: spec.items
          }
        };
        this.createIndexDefinitions(schema as any, definitions, "");
      }
    }

    return definitions;
  }

  async getIndexesWillBeDropped(collection: Collection<any>): Promise<string[]> {
    const existings: ExistingIndex[] = await collection.listIndexes().toArray();
    return existings
      .filter(existing => this.isExistingSingleFieldIndex(existing))
      .map(existing => existing.name);
  }

  isExistingSingleFieldIndex(index: ExistingIndex) {
    const keys = Object.keys(index.key);
    // we can not remove _id index since it's default index of mongodb
    return keys.length == 1 && keys[0] != "_id";
  }

  collNameToId(collName: string) {
    return collName.startsWith("bucket_") ? collName.replace("bucket_", "") : undefined;
  }
}
