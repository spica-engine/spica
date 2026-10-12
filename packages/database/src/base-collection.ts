import {Observable} from "rxjs";
import {
  ChangeStreamOptions,
  CollectionOptions,
  CollectionStatus,
  CreateIndexOptions,
  DocumentFilter,
  DocumentUpdate,
  FindOneAndDeleteOptions,
  FindOneAndReplaceOptions,
  FindOneAndUpdateOptions,
  FindOptions,
  ICollection,
  Id,
  ISupportsReadPlan,
  OptionalUnlessRequiredId,
  ReadPlan,
  ReadResult,
  UpdateOptions,
  WithId
} from "@spica-server/database-driver";
import {ProfilerEntry} from "@spica-server/interface-database";
import {DatabaseService} from "./database.service.js";

/**
 * The base class that satisfies `ICollection` by **delegating** (Phase 6 slice 6a).
 *
 * Why delegation rather than inheritance: 28 domain services are written as
 * `extends BaseCollection<X>("name")`, that is, the service class **IS-A collection**. When the two
 * drivers live side by side (K-5) which driver the base class belongs to is known at runtime, while
 * `extends` is fixed at compile time — a base class pinned to Mongo could never be used on PostgreSQL.
 *
 * This class holds an inner `ICollection` and takes it from `database.collection()`; whichever driver
 * was selected is the one that arrives. None of the 28 services change.
 *
 * The forwarding methods go to `this.inner`, not to `super`; if something is to be added or removed, the
 * `ICollection` contract is the single source.
 */
export abstract class DelegatingCollection<T = any> implements ICollection<T> {
  /**
   * `public`, because `BaseCollection()` returns an anonymous class and declaration emit cannot write a
   * `protected` member of an anonymous class (TS4094). The contract surface is still `ICollection`:
   * consumers use the forwarded methods, not this.
   */
  readonly inner: ICollection<T>;

  /**
   * The database handle. `MongoCollection` exposed it under the name `db` and three services use it
   * (`createCollection`, `dropCollection`, `command`); the name is kept, but its type is neutral now.
   */
  readonly db: DatabaseService;

  constructor(database: DatabaseService, name: string, options: CollectionOptions = {}) {
    this.db = database;
    this.inner = database.collection<T>(name, options);
  }

  /** See `ICollection.initialized`. */
  get initialized(): Promise<void> | undefined {
    return this.inner.initialized;
  }

  /**
   * Waits for `afterInit` before the module is considered started.
   *
   * Nest awaits this hook, so a service's indexes exist before the first request is served. It only
   * **reports** a failure rather than raising: both drivers have always tolerated a failed `afterInit`,
   * and turning that into a boot failure would be a separate decision. A subclass that defines its own
   * `onModuleInit` has to call this one — `BucketService` does.
   *
   * It does not cover every case: a service-level spec that only calls
   * `Test.createTestingModule(...).compile()` never initializes the module, so such a spec awaits
   * `initialized` itself.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.initialized;
    } catch (error) {
      console.error(`[${this.name}] afterInit failed: ${error?.message ?? error}`);
    }
  }

  get name(): string {
    return this.inner.name;
  }

  get options(): CollectionOptions {
    return this.inner.options;
  }

  find(filter?: DocumentFilter<T>, options?: FindOptions): Promise<WithId<T>[]> {
    return this.inner.find(filter, options);
  }

  findOne(filter: DocumentFilter<T>, options?: FindOptions): Promise<WithId<T>> {
    return this.inner.findOne(filter, options);
  }

  estimatedDocumentCount(): Promise<number> {
    return this.inner.estimatedDocumentCount();
  }

  countDocuments(filter?: DocumentFilter<T>): Promise<number> {
    return this.inner.countDocuments(filter);
  }

  getStatus(): Promise<CollectionStatus> {
    return this.inner.getStatus();
  }

  insertOne(doc: OptionalUnlessRequiredId<T>): Promise<WithId<T>> {
    return this.inner.insertOne(doc);
  }

  insertMany(docs: OptionalUnlessRequiredId<T>[]): Promise<Id[]> {
    return this.inner.insertMany(docs);
  }

  replaceOne(filter: DocumentFilter<T>, doc: T, options?: UpdateOptions): Promise<number> {
    return this.inner.replaceOne(filter, doc, options);
  }

  updateOne(
    filter: DocumentFilter<T>,
    update: DocumentUpdate<T>,
    options?: UpdateOptions
  ): Promise<number> {
    return this.inner.updateOne(filter, update, options);
  }

  updateMany(
    filter: DocumentFilter<T>,
    update: DocumentUpdate<T>,
    options?: UpdateOptions
  ): Promise<number> {
    return this.inner.updateMany(filter, update, options);
  }

  deleteOne(filter: DocumentFilter<T>, options?: FindOptions): Promise<number> {
    return this.inner.deleteOne(filter, options);
  }

  deleteMany(filter: DocumentFilter<T>, options?: FindOptions): Promise<number> {
    return this.inner.deleteMany(filter, options);
  }

  findOneAndUpdate(
    filter: DocumentFilter<T>,
    update: DocumentUpdate<T>,
    options?: FindOneAndUpdateOptions
  ): Promise<WithId<T> | null> {
    return this.inner.findOneAndUpdate(filter, update, options);
  }

  findOneAndReplace(
    filter: DocumentFilter<T>,
    doc: T,
    options?: FindOneAndReplaceOptions
  ): Promise<WithId<T> | null> {
    return this.inner.findOneAndReplace(filter, doc, options);
  }

  findOneAndDelete(
    filter: DocumentFilter<T>,
    options?: FindOneAndDeleteOptions
  ): Promise<WithId<T> | null> {
    return this.inner.findOneAndDelete(filter, options);
  }

  createIndex(spec: any, options?: CreateIndexOptions): Promise<string> {
    return this.inner.createIndex(spec, options);
  }

  upsertTTLIndex(expireAfterSeconds: number): Promise<unknown> {
    return this.inner.upsertTTLIndex(expireAfterSeconds);
  }

  watch(pipeline?: object[], options?: ChangeStreamOptions): Observable<any> {
    return this.inner.watch(pipeline, options);
  }

  aggregate<R = any>(pipeline?: object[], options?: Record<string, any>): any {
    return this.inner.aggregate<R>(pipeline, options);
  }

  /**
   * The neutral read plan (K-3). It stood in the contract as `ISupportsReadPlan` but was **not
   * forwarded** through this bridge, so no service could reach it — one of the reasons `ReadPlan` had no
   * producer inside `packages/api`.
   *
   * `read` is **not** part of `ICollection`: no driver implemented it in Phase 1 and making it a
   * mandatory method would have been a promise that is not kept. So the forwarding is optional and
   * raises loudly on a driver that does not implement it; because the caller (`findDocuments`) branches
   * on the capability, no silently wrong result occurs (K-4).
   */
  read<R = T>(plan: ReadPlan): Promise<ReadResult<R>> {
    const inner = this.inner as unknown as Partial<ISupportsReadPlan<R>>;
    if (typeof inner.read !== "function") {
      throw new Error(
        `The '${this.name}' collection's driver does not implement read(); use aggregate().`
      );
    }
    return inner.read(plan);
  }

  findOnProfiler(filter?: DocumentFilter<Omit<ProfilerEntry, "ns">>): any {
    return this.inner.findOnProfiler(filter);
  }

  collection(name: string, options?: CollectionOptions): ICollection<any> {
    return this.inner.collection(name, options);
  }
}
