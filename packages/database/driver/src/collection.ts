import {Observable} from "rxjs";
import {Id} from "./id.js";
import {
  CollectionOptions,
  CollectionStatus,
  DocumentFilter,
  DocumentUpdate,
  FindOneAndDeleteOptions,
  FindOneAndReplaceOptions,
  FindOneAndUpdateOptions,
  FindOptions,
  OptionalUnlessRequiredId,
  UpdateOptions,
  WithId
} from "./filter.js";
import {ChangeStreamOptions} from "./change-stream.js";
import {CreateIndexOptions} from "./index-manager.js";
import {ProfilerEntry} from "./capabilities.js";
import {ReadPlan, ReadResult} from "./read-plan.js";

/**
 * The document collection contract. `read()` runs the neutral read plan; `aggregate()` is a Mongo-shaped
 * escape hatch whose support is declared as a capability.
 */
export interface ICollection<T = any> {
  readonly name: string;
  readonly options: CollectionOptions;
  /**
   * Resolves once `CollectionOptions.afterInit` has finished, indexes included. A constructor cannot be
   * async, so without awaiting this a write can land before a unique index exists: the duplicate slips
   * through **and** the index build fails afterwards.
   */
  readonly initialized?: Promise<void>;

  // Reads — document CRUD
  find(filter?: DocumentFilter<T>, options?: FindOptions): Promise<WithId<T>[]>;
  findOne(filter: DocumentFilter<T>, options?: FindOptions): Promise<WithId<T>>;
  /** An **approximate** count, from collection metadata; it accepts no filter and is not exact. */
  estimatedDocumentCount(): Promise<number>;

  /** An exact count, which scans. Separate from the estimate on purpose: speed against accuracy. */
  countDocuments(filter?: DocumentFilter<T>): Promise<number>;

  // `drop()` is deliberately NOT here: it is a database-level operation (`IDatabase.dropCollection`), and
  // on this interface the name clashes with domain methods such as `BucketService.drop(id)`.
  getStatus(): Promise<CollectionStatus>;

  // Writes
  insertOne(doc: OptionalUnlessRequiredId<T>): Promise<WithId<T>>;
  insertMany(docs: OptionalUnlessRequiredId<T>[]): Promise<Id[]>;
  replaceOne(filter: DocumentFilter<T>, doc: T, options?: UpdateOptions): Promise<number>;
  updateOne(
    filter: DocumentFilter<T>,
    update: DocumentUpdate<T>,
    options?: UpdateOptions
  ): Promise<number>;
  updateMany(
    filter: DocumentFilter<T>,
    update: DocumentUpdate<T>,
    options?: UpdateOptions
  ): Promise<number>;
  deleteOne(filter: DocumentFilter<T>, options?: FindOptions): Promise<number>;
  deleteMany(filter: DocumentFilter<T>, options?: FindOptions): Promise<number>;

  // Read-and-write
  findOneAndUpdate(
    filter: DocumentFilter<T>,
    update: DocumentUpdate<T>,
    options?: FindOneAndUpdateOptions
  ): Promise<WithId<T>>;
  findOneAndReplace(
    filter: DocumentFilter<T>,
    doc: T,
    options?: FindOneAndReplaceOptions
  ): Promise<WithId<T>>;
  findOneAndDelete(
    filter: DocumentFilter<T>,
    options?: FindOneAndDeleteOptions
  ): Promise<WithId<T>>;

  // Indexes
  /** The callers pass a Mongo index spec (`{field: 1}`), so the signature is permissive. */
  createIndex(spec: any, options?: CreateIndexOptions): Promise<string>;
  /**
   * A TTL index; without a native one the driver serves it with a sweeper and declares that as a
   * capability.
   *
   * **Precondition:** the collection has to exist — on Mongo `listIndexes()` raises `ns does not exist`
   * otherwise, while PostgreSQL tolerates it because the table is already there.
   */
  upsertTTLIndex(expireAfterSeconds: number): Promise<unknown>;

  /**
   * The change stream, emitting the **driver-specific** payload: it is user-visible (a database trigger
   * function sees it), so the type stays vague here rather than promising a neutral one. `changes()` is the
   * neutral surface.
   */
  watch(pipeline?: object[], options?: ChangeStreamOptions): Observable<any>;

  // Mongo-shaped escape hatches — declared through `DriverCapabilities`
  aggregate<R = any>(
    pipeline?: object[],
    options?: Record<string, any>
  ): AsyncIterable<R> & {toArray(): Promise<R[]>; next(): Promise<R | null>};
  /** Driver-specific: Mongo returns a cursor (`FindCursor`), not a Promise. */
  findOnProfiler(filter?: DocumentFilter<Omit<ProfilerEntry, "ns">>): any;

  /** Switching to another collection on the same database (today's `collection()` method). */
  collection(name: string, options?: CollectionOptions): ICollection<any>;
}

/** The drivers that can run the neutral read plan; kept separate so a driver can declare the gap. */
export interface ISupportsReadPlan<T = any> {
  read(plan: ReadPlan): Promise<ReadResult<T>>;
}

export type IReadableCollection<T = any> = ICollection<T> & ISupportsReadPlan<T>;
