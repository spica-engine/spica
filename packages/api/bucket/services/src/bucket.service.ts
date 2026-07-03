import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Optional
} from "@nestjs/common";
import {Validator} from "@spica-server/core-schema";
import {Default} from "@spica-server/interface-core";
import {
  BaseCollection,
  Collection,
  DatabaseService,
  Filter,
  FindOneAndReplaceOptions,
  ObjectId,
  UpdateFilter,
  UpdateOptions,
  WithId
} from "@spica-server/database";
import {PreferenceService} from "@spica-server/preference-services";
import {deepCopy} from "@spica-server/core-patch";
import {BehaviorSubject, Observable, Subscription} from "rxjs";
import {filter, switchMap} from "rxjs/operators";
import {BucketChangeDispatcher} from "./change-dispatcher.js";
import {getBucketDataCollection} from "./index.js";
import {
  IndexDefinition,
  ExistingIndex,
  Bucket,
  BucketPreferences,
  BUCKET_DATA_LIMIT
} from "@spica-server/interface-bucket";
import * as crypto from "crypto";

@Injectable()
export class BucketService
  extends BaseCollection<Bucket>("buckets")
  implements OnModuleInit, OnModuleDestroy
{
  schemaChangeEmitter: BehaviorSubject<any> = new BehaviorSubject<any>(undefined);

  private readonly logger = new Logger(BucketService.name);
  private schemaCache = new Map<string, Bucket>();
  private cacheSub?: Subscription;
  private destroyed = false;

  constructor(
    db: DatabaseService,
    private pref: PreferenceService,
    private validator: Validator,
    private changeDispatcher: BucketChangeDispatcher,
    @Optional() @Inject(BUCKET_DATA_LIMIT) private bucketDataLimit
  ) {
    super(db, {
      collectionOptions: {changeStreamPreAndPostImages: {enabled: true}}
    });
  }

  async onModuleInit() {
    await this.warmSchemaCache();
    this.startSchemaCacheWatch();
  }

  onModuleDestroy() {
    this.destroyed = true;
    this.cacheSub?.unsubscribe();
  }

  private async warmSchemaCache() {
    const all = await super.find();
    this.schemaCache = new Map(all.map(bucket => [bucket._id.toString(), bucket]));
  }

  private startSchemaCacheWatch() {
    if (this.destroyed) {
      return;
    }
    this.cacheSub = this.changeDispatcher.watch().subscribe({
      next: async change => {
        const id = change.documentKey._id.toString();
        if (change.operationType === "delete") {
          this.schemaCache.delete(id);
          return;
        }
        const bucket = await super.findOne({_id: change.documentKey._id});
        if (bucket) {
          this.schemaCache.set(id, bucket);
        } else {
          this.schemaCache.delete(id);
        }
      },
      error: error =>
        this.logger.error(
          `bucket schema cache watch error: ${error instanceof Error ? error.message : error}`
        )
    });
  }

  resolveSchema = (id: string | ObjectId): Bucket | Promise<Bucket> => {
    const cached = this.schemaCache.get(id.toString());
    return cached ? deepCopy(cached) : this.findOne({_id: new ObjectId(id)});
  };

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

    this.schemaCache.set(insertedBucket._id.toString(), deepCopy(insertedBucket));
    this.changeDispatcher.dispatch({
      operationType: "insert",
      documentKey: {_id: insertedBucket._id}
    });

    await this.db.createCollection(getBucketDataCollection(insertedBucket._id));

    await this.updateIndexes(bucket);

    return insertedBucket;
  }

  findOneAndReplace(
    filter: Filter<{_id: ObjectId}>,
    doc: Bucket,
    options?: FindOneAndReplaceOptions
  ): Promise<WithId<Bucket>> {
    return super.findOneAndReplace(filter, doc, options).then(r => {
      const replaced = {...doc, _id: filter._id as ObjectId} as WithId<Bucket>;
      this.schemaCache.set(replaced._id.toString(), deepCopy(replaced));
      this.changeDispatcher.dispatch({
        operationType: "replace",
        documentKey: {_id: replaced._id}
      });
      return this.updateIndexes(replaced).then(() => r);
    });
  }

  async drop(id: string | ObjectId) {
    const schema = await super.findOneAndDelete({_id: new ObjectId(id)});
    if (!schema) {
      throw new NotFoundException(`Bucket with ID ${id} does not exist.`);
    }
    this.schemaCache.delete(id.toString());
    this.changeDispatcher.dispatch({operationType: "delete", documentKey: {_id: schema._id}});
    await this.db.dropCollection(getBucketDataCollection(id));
    return schema;
  }

  async updateMany(
    filter: Filter<Bucket>,
    update: UpdateFilter<Bucket> | Partial<Bucket>,
    options?: UpdateOptions
  ): Promise<number> {
    const affected = await super.find(filter, {projection: {_id: 1}});
    const result = await super.updateMany(filter, update, options);
    for (const {_id} of affected) {
      this.changeDispatcher.dispatch({operationType: "update", documentKey: {_id}});
    }
    return result;
  }

  watchBucket(bucketId: string, propagateOnStart: boolean): Observable<Bucket> {
    const _id = new ObjectId(bucketId);
    return new Observable(observer => {
      if (propagateOnStart) {
        super.findOne({_id}).then(bucket => observer.next(bucket));
      }
      const sub = this.changeDispatcher
        .watch()
        .pipe(
          filter(
            change => change.documentKey._id.equals(_id) && change.operationType !== "delete"
          ),
          switchMap(change => super.findOne({_id: change.documentKey._id}))
        )
        .subscribe(bucket => observer.next(bucket));
      return () => sub.unsubscribe();
    });
  }

  watchPreferences(propagateOnStart: boolean): Observable<BucketPreferences> {
    return this.pref.watchPreference("bucket", {propagateOnStart});
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
