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
  DatabaseService,
  Filter,
  FindOneAndReplaceOptions,
  getIndexManager,
  ObjectId,
  toIndexSpec,
  UpdateFilter,
  UpdateOptions,
  WithId
} from "@spica-server/database";
import {IIndexManager} from "@spica-server/database-driver";
import {PreferenceService} from "@spica-server/preference-services";
import {deepCopy} from "@spica-server/core-patch";
import {BehaviorSubject, Observable, Subscription} from "rxjs";
import {filter, switchMap} from "rxjs/operators";
import {BucketChangeDispatcher} from "./change-dispatcher.js";
import {bucketIdFromCollection, getBucketDataCollection} from "./index.js";
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
    super(db);

    /**
     * **In the constructor, not `onModuleInit`:** a service-level spec settles for `.compile()` and never
     * initializes the module, and without the registration every `createCollection` raises. It is safe here
     * because the resolver is a pure read over `schemaCache`, with no warm-up to wait for.
     */
    this.registerSchemaResolver();
  }

  async onModuleInit() {
    await super.onModuleInit();
    await this.warmSchemaCache();
    this.startSchemaCacheWatch();
  }

  /**
   * Registers itself with the PostgreSQL driver as the schema source: opening a collection there needs the
   * bucket schema, and those schemas live here. The driver's constructor cannot ask for it — that would be a
   * circular dependency — so a registration slot is used.
   *
   * MongoDB has no such slot and the condition is skipped: no schema is needed there.
   *
   * The resolution has to be **synchronous**, because `collection()` is, which works because `schemaCache` is
   * fed by a change stream; a bucket that is not in it returns `undefined` and the driver raises.
   */
  private registerSchemaResolver(): void {
    // Written structurally rather than imported: the PG adapter is loaded lazily and must stay that way.
    const db = this.db as unknown as {
      setSchemaResolver?: (resolver: (collection: string) => Bucket | undefined) => void;
    };
    if (typeof db.setSchemaResolver !== "function") {
      return;
    }

    db.setSchemaResolver(collection => {
      const id = bucketIdFromCollection(collection);
      return id ? this.schemaCache.get(id) : undefined;
    });
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

  async findOneAndReplace(
    filter: Filter<{_id: ObjectId}>,
    doc: Bucket,
    options?: FindOneAndReplaceOptions
  ): Promise<WithId<Bucket>> {
    const id = filter._id as ObjectId;

    /**
     * The old definition is read **before** the change: what `findOneAndReplace` returns is the caller's
     * choice, and both callers ask for the document *after* it. Diffing the new definition against itself
     * sees no change and skips the DDL silently.
     *
     * The cache is tried first; a cold cache falls back to the store, because a missing `previous` loses the
     * column difference.
     */
    const previous = this.schemaCache.get(id.toString()) ?? (await super.findOne({_id: id}));

    const result = await super.findOneAndReplace(filter, doc, options);

    const replaced = {...doc, _id: id} as WithId<Bucket>;
    this.schemaCache.set(id.toString(), deepCopy(replaced));
    this.changeDispatcher.dispatch({operationType: "replace", documentKey: {_id: id}});

    /**
     * The change is reflected onto the **physical** schema too. A document store needs none of it — a new
     * field appears on the first write — so `alignCollection` is undefined there and the condition is skipped.
     */
    await this.db.alignCollection?.(getBucketDataCollection(id), previous ?? undefined);

    await this.updateIndexes(replaced);
    return result;
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
          filter(change => change.documentKey._id.equals(_id) && change.operationType !== "delete"),
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
    const indexes = getIndexManager(this.db, getBucketDataCollection(bucket._id));

    const existingIndexes = await indexes.list();

    const existingNames = new Set(existingIndexes.map(index => index.name));

    const {indexesToDrop, indexesToCreate} = this.calculateIndexChanges(
      Array.from(existingNames),
      bucket
    );

    const errors = [];

    await this.dropIndexes(indexes, indexesToDrop, errors);
    await this.createIndexes(indexes, indexesToCreate, errors);

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

  async dropIndexes(manager: IIndexManager, indexNames: string[], errors: Error[]): Promise<void> {
    await Promise.all(indexNames.map(name => manager.drop(name).catch(err => errors.push(err))));
  }

  async createIndexes(
    manager: IIndexManager,
    indexes: IndexDefinition[],
    errors: Error[]
  ): Promise<void> {
    await Promise.all(
      indexes.map(idx =>
        manager
          .create(toIndexSpec(idx.definition, idx.name), idx.options)
          .catch(err => errors.push(err))
      )
    );
  }

  collNameToId(collName: string) {
    return collName.startsWith("bucket_") ? collName.replace("bucket_", "") : undefined;
  }
}
