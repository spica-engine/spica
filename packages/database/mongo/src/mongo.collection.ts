// This directory is the only place in the repository that touches `mongodb`.
import {
  AggregationCursor,
  Collection,
  Filter,
  FindOptions,
  FindOneAndDeleteOptions,
  FindOneAndReplaceOptions,
  FindOneAndUpdateOptions,
  InsertOneResult,
  ObjectId,
  UpdateFilter,
  UpdateOptions,
  OptionalUnlessRequiredId,
  WithId,
  Document,
  AggregateOptions,
  IndexSpecification,
  CreateIndexesOptions,
  ChangeStreamOptions,
  ChangeStreamDocument
} from "mongodb";
import {MongoDatabase} from "./mongo.database.js";
import {InitializeOptions, ProfilerEntry} from "@spica-server/interface-database";
import {Observable} from "rxjs";
import {
  ChangeOperation,
  DatabaseChange,
  ICollection,
  ISupportsChanges,
  ChangeStreamOptions as NeutralChangeStreamOptions,
  ResumeToken
} from "@spica-server/database-driver";

export class MongoCollection<T> implements ICollection<T>, ISupportsChanges<T> {
  _coll: Collection<T>;

  options: InitializeOptions;

  constructor(
    public readonly db: MongoDatabase,
    public readonly _collection: string,
    public readonly _options: InitializeOptions = {}
  ) {
    this._coll = db.raw.collection(this._collection);

    this.options = this._options;
  }

  private _initialized?: Promise<void>;

  /** See `ICollection.initialized`. Undefined when there is nothing to wait for. */
  get initialized(): Promise<void> | undefined {
    return this._initialized;
  }

  /**
   * Deliberately not done in the constructor: both creation sites call this immediately, so the work
   * still starts as early as it did before, but construction itself stays synchronous.
   */
  beginInitialization(): this {
    const wanted = this.options.collectionOptions || this.options.afterInit;
    if (this._initialized !== undefined || !wanted) return this;
    this._initialized = this.initCollection()
      .then(() => this.options.afterInit?.())
      .then(() => undefined);
    /**
     * Nobody is obliged to await `initialized` — a spec that only calls `.compile()` never reaches
     * `onModuleInit`. Without a handler here a failed `afterInit` becomes an unhandled rejection and
     * kills the process; with one, `initialized` still rejects for whoever does await it.
     */
    this._initialized.catch(() => {});
    return this;
  }

  /**
   * The name the contract (`ICollection.name`) asks for. A read-only alias of the existing `_collection`
   * field; it changes no behaviour, it only satisfies the contract.
   */
  get name(): string {
    return this._collection;
  }

  initCollection() {
    return this.db.raw
      .createCollection(this._collection, this.options.collectionOptions)
      .catch(e => {
        if (e.codeName === "NamespaceExists") {
          return;
        }
        throw e;
      });
  }

  async getStatus() {
    return {
      limit: this.options ? this.options.entryLimit : undefined,
      current: await this._coll.estimatedDocumentCount(),
      unit: "count"
    };
  }

  estimatedDocumentCount(): Promise<number> {
    return this._coll.estimatedDocumentCount();
  }

  countDocuments(filter: Filter<T> = {}): Promise<number> {
    return this._coll.countDocuments(filter);
  }

  aggregate<ResponseType>(
    pipeline?: object[],
    options?: AggregateOptions
  ): AggregationCursor<ResponseType> {
    return this._coll.aggregate(pipeline, options ?? {allowDiskUse: true});
  }

  async documentCountLimitValidation(insertedDocumentCount: number) {
    if (this.options && this.options.entryLimit) {
      const existingDocumentCount = await this._coll.estimatedDocumentCount();

      if (existingDocumentCount + insertedDocumentCount > this.options.entryLimit) {
        throw new Error("Maximum number of documents has been reached");
      }
    }
  }

  // Insert
  async insertOne(doc: OptionalUnlessRequiredId<T>): Promise<WithId<T>> {
    await this.documentCountLimitValidation(1);

    const result: InsertOneResult<T> = await this._coll.insertOne(doc);
    doc._id = result.insertedId;
    return doc as WithId<T>;
  }

  async insertMany(docs: Array<OptionalUnlessRequiredId<T>>): Promise<ObjectId[]> {
    await this.documentCountLimitValidation(docs.length);

    return this._coll.insertMany(docs).then(t => Object.values(t.insertedIds));
  }

  // Find
  findOne(filter: Filter<T>, options?: FindOptions): Promise<WithId<T>> {
    return this._coll.findOne(filter, options);
  }

  find(filter?: Filter<T>, options?: FindOptions): Promise<WithId<T>[]> {
    return this._coll.find(filter, options).toArray();
  }

  // Delete
  findOneAndDelete(filter: Filter<T>, options?: FindOneAndDeleteOptions): Promise<WithId<T>> {
    return this._coll.findOneAndDelete(filter, options);
  }

  deleteOne(filter: Filter<T>, options?: FindOptions): Promise<number> {
    return this._coll.deleteOne(filter, options).then(r => r.deletedCount);
  }

  deleteMany(filter: Filter<T>, options?: FindOptions): Promise<number> {
    return this._coll.deleteMany(filter, options).then(r => r.deletedCount);
  }

  // Replace
  findOneAndReplace(
    filter: Filter<T>,
    doc: T,
    options?: FindOneAndReplaceOptions
  ): Promise<WithId<T>> {
    return this._coll.findOneAndReplace(filter, doc, options);
  }

  replaceOne(filter: Filter<T>, doc: T, options?: UpdateOptions): Promise<number> {
    return this._coll.replaceOne(filter, doc, options).then(r => r.modifiedCount);
  }

  // Update
  updateMany(
    filter: Filter<T>,
    update: UpdateFilter<T> | T,
    options?: UpdateOptions
  ): Promise<number> {
    return this._coll.updateMany(filter, update, options).then(r => r.modifiedCount);
  }

  updateOne(
    filter: Filter<T>,
    update: UpdateFilter<T> | T,
    options?: UpdateOptions
  ): Promise<number> {
    return this._coll.updateOne(filter, update, options).then(r => r.modifiedCount);
  }

  findOneAndUpdate(
    filter: Filter<T>,
    update: UpdateFilter<T> | T,
    options?: FindOneAndUpdateOptions
  ): Promise<WithId<T>> {
    return this._coll.findOneAndUpdate(filter, update, options);
  }

  // Time to live index
  upsertTTLIndex(expireAfterSeconds: number) {
    return this._coll
      .listIndexes()
      .toArray()
      .then<string | Document>(indexes => {
        const ttlIndex = indexes.find(index => index.name == "created_at_1");

        if (!ttlIndex) {
          return this._coll.createIndex({created_at: 1}, {expireAfterSeconds: expireAfterSeconds});
        } else if (ttlIndex && ttlIndex.expireAfterSeconds != expireAfterSeconds) {
          return this.db.raw.command({
            collMod: this._collection,
            index: {
              keyPattern: {created_at: 1},
              expireAfterSeconds: expireAfterSeconds
            }
          });
        }
      });
  }

  /**
   * The promise is **returned**, not dropped. It used to be called and discarded, which made the
   * `Promise.all([...createIndex...])` that every `afterInit` is written as resolve before any index
   * existed: a unique index was announced as ready while the collection was still accepting duplicates,
   * and a failed build surfaced much later as an unhandled rejection that takes the process down.
   */
  createIndex(indexSpec: IndexSpecification, options?: CreateIndexesOptions): Promise<string> {
    return this._coll.createIndex(indexSpec, options);
  }

  // profiler
  findOnProfiler(filter: Filter<Omit<ProfilerEntry, "ns">> = {}) {
    (filter as Filter<ProfilerEntry>).ns = this._coll.namespace;
    return this.db.raw.collection<ProfilerEntry>("system.profile").find(filter);
  }

  collection(collection: string, options?: InitializeOptions) {
    return new MongoCollection(this.db, collection, options).beginInitialization();
  }

  /**
   * The parameter is the **neutral** option type, which is what `ICollection` declares; it used to be
   * mongodb's own, so a neutral-only field could not be passed without a type error.
   */
  watch(
    pipeline?: object[],
    options?: NeutralChangeStreamOptions
  ): Observable<ChangeStreamDocument<T>> {
    // `onReady` is answered here and `operations` belongs to `changes()`; neither is a driver option.
    const {onReady, operations, ...streamOptions} = options ?? {};

    return new Observable(observer => {
      const stream = this._coll.watch(pipeline, {
        maxAwaitTimeMS: this.db.changeStreamAwaitTimeMS,
        ...(streamOptions as ChangeStreamOptions)
      });
      stream.on("change", change => observer.next(change));
      stream.on("error", error => observer.error(error));

      /**
       * `resumeToken` is the readiness signal: it is filled from the `aggregate` reply, so once it is set
       * the server has a cursor and every later write is inside the stream's window. `resumeTokenChanged`
       * carries it, and the token can already be there by the time we subscribe, so both are covered.
       */
      if (onReady) {
        let announced = false;
        const announce = () => {
          if (announced || !stream.resumeToken) return;
          announced = true;
          stream.off("resumeTokenChanged", announce);
          onReady();
        };
        stream.on("resumeTokenChanged", announce);
        announce();
      }

      return () => {
        if (!stream.closed) {
          stream.close();
        }
      };
    });
  }

  /**
   * The neutral event stream. `watch()` emits a raw `ChangeStreamDocument` and stays that way;
   * this surface turns it into the contract's `DatabaseChange`, so the consumer does not know the
   * backend.
   *
   * The `operations` filter reaches the pipeline — filtering on the client side would mean discarding an
   * event that already crossed the network instead of the server never sending it.
   */
  changes(options: NeutralChangeStreamOptions = {}): Observable<DatabaseChange<T>> {
    const pipeline = options.operations?.length
      ? [{$match: {operationType: {$in: options.operations}}}]
      : [];

    const driverOptions: ChangeStreamOptions = {
      fullDocument: options.fullDocument === "updateLookup" ? "updateLookup" : undefined,
      maxAwaitTimeMS: options.maxAwaitTimeMS
    };

    /**
     * Mongo's resume token is opaque. The contract wants a `(txid, seq)` pair because progress runs on
     * txid on PostgreSQL; there is no such distinction on Mongo, so the opaque value is carried in
     * the `opaque` field and `txid`/`seq` are **stand-ins rather than derivatives** of it. Resuming is
     * done through `opaque` only.
     */
    if (options.resumeAfter?.opaque) {
      (driverOptions as ChangeStreamOptions).resumeAfter = {_data: options.resumeAfter.opaque};
    }

    return new Observable<DatabaseChange<T>>(observer => {
      const stream = this._coll.watch(pipeline, driverOptions);
      stream.on("change", change =>
        observer.next(toNeutralChange<T>(change, this._coll.collectionName))
      );
      stream.on("error", error => observer.error(error));

      return () => {
        if (!stream.closed) stream.close();
      };
    });
  }
}

function toNeutralChange<T>(
  change: ChangeStreamDocument<T>,
  collection: string
): DatabaseChange<T> {
  const raw = change as any;
  const opaque: string | undefined = raw._id?._data;
  const token: ResumeToken = {txid: "0", seq: "0", opaque};

  const neutral: DatabaseChange<T> = {
    operation: change.operationType as ChangeOperation,
    collection: raw.ns?.coll || collection,
    token
  };

  if (raw.documentKey?._id !== undefined) neutral.documentId = raw.documentKey._id;
  if (raw.fullDocument) neutral.document = raw.fullDocument;
  if (raw.fullDocumentBeforeChange) neutral.previousDocument = raw.fullDocumentBeforeChange;
  // Mongo already gives name→value; it is carried through as it is.
  if (raw.updateDescription?.updatedFields) {
    neutral.updatedFields = raw.updateDescription.updatedFields;
  }
  if (raw.updateDescription?.removedFields?.length) {
    neutral.removedFields = raw.updateDescription.removedFields;
  }

  return neutral;
}
