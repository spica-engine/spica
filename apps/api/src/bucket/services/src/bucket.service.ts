import {Inject, Injectable, NotFoundException, Optional} from "@nestjs/common";
import {Validator} from "@spica-server/core/schema";
import {Default} from "@spica-server/interface/core";
import {
  BaseCollection,
  Collection,
  DatabaseService,
  Filter,
  FindOneAndReplaceOptions,
  ObjectId,
  WithId
} from "@spica-server/database";
import {PreferenceService} from "@spica-server/preference/services";
import {BehaviorSubject, Observable} from "rxjs";
import {getBucketDataCollection} from "./";
import {
  IndexDefinition,
  ExistingIndex,
  Bucket,
  BucketPreferences,
  BUCKET_DATA_LIMIT
} from "@spica-server/interface/bucket";
import * as crypto from "crypto";

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
    filter: Filter<{_id: ObjectId}>,
    doc: Bucket,
    options?: FindOneAndReplaceOptions
  ): Promise<WithId<Bucket>> {
    return super
      .findOneAndReplace(filter, doc, options)
      .then(r => this.updateIndexes({...doc, _id: filter._id as ObjectId}).then(() => r));
  }

  async drop(id: string | ObjectId) {
    const schema = await super.findOneAndDelete({_id: new ObjectId(id)});
    if (!schema) {
      throw new NotFoundException(`Bucket with ID ${id} does not exist.`);
    }
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
      stream.on("change", change =>
        observer.next("fullDocument" in change ? change.fullDocument : undefined)
      );
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

  generateIndexName(definition: Record<string, number>, options: Record<string, any>): string {
    const defsParts = [];
    for (const key of Object.keys(definition)) {
      defsParts.push(`${key}_${definition[key]}`);
    }
    const defs = defsParts.join("_");

    const sortedOptions: Record<string, any> = {};
    Object.keys(options)
      .sort()
      .forEach(k => {
        sortedOptions[k] = options[k];
      });

    const optionsStr = JSON.stringify(sortedOptions);

    const hash = crypto.createHash("sha1").update(optionsStr).digest("hex").slice(0, 8);

    return `${defs}-${hash}`;
  }

  async updateIndexes(bucket: Bucket): Promise<void> {
    const collection = this.db.collection(getBucketDataCollection(bucket._id));

    const existingIndexes = await collection.listIndexes().toArray();

    const existingNames = new Set(existingIndexes.map(index => index.name));

    const {indexesToDrop, indexesToCreate} = this.calculateIndexChanges(
      Array.from(existingNames),
      bucket
    );

    const errors = [];

    await this.dropIndexes(collection, indexesToDrop, errors);
    await this.createIndexes(collection, indexesToCreate, errors);

    if (errors.length) {
      throw new Error(errors.map(e => e.message).join("; "));
    }
  }

  calculateIndexChanges(
    existingIndexNames: string[],
    bucket: Bucket
  ): {
    indexesToDrop: string[];
    indexesToCreate: IndexDefinition[];
  } {
    const newIndexes = (bucket.indexes || []).map(idx => {
      const name = this.generateIndexName(idx.definition, idx.options || {});
      return {...idx, name};
    });

    const desiredNames = new Set(newIndexes.map(idx => idx.name));

    // _id is default index for MondoDB collections, we cant drop it
    // _id_ is internal name for _id index in MongoDB so we are filtering out
    const existingNames = new Set(existingIndexNames.filter(name => name !== "_id_"));

    const indexesToDrop = Array.from(existingNames).filter(name => !desiredNames.has(name));
    const indexesToCreate = newIndexes.filter(idx => !existingNames.has(idx.name));

    return {indexesToDrop, indexesToCreate};
  }

  async dropIndexes(collection: Collection, indexNames: string[], errors: Error[]): Promise<void> {
    await Promise.all(
      indexNames.map(name => collection.dropIndex(name).catch(err => errors.push(err)))
    );
  }

  async createIndexes(
    collection: Collection,
    indexes: IndexDefinition[],
    errors: Error[]
  ): Promise<void> {
    await Promise.all(
      indexes.map(idx =>
        collection
          .createIndex(idx.definition, {...idx.options, name: idx.name})
          .catch(err => errors.push(err))
      )
    );
  }

  collNameToId(collName: string) {
    return collName.startsWith("bucket_") ? collName.replace("bucket_", "") : undefined;
  }
}
