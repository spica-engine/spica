import {ICollection} from "./collection.js";
import {CollectionOptions} from "./filter.js";
import {DriverCapabilities} from "./capabilities.js";
import {IIndexManager} from "./index-manager.js";
import {ISchemaManager} from "./schema-manager.js";

/**
 * The database contract — the surface the drivers satisfy **today**.
 *
 * The scope was derived from `DatabaseService`'s measured member list: of `Db`'s ~70 members only nine
 * are used (`packages/database/src/database.service.ts`). New capabilities (`indexes()`, `schema()`)
 * live in separate interfaces — see the note below.
 */
export interface IDatabase {
  readonly name: string;
  readonly capabilities: DriverCapabilities;

  collection<T = any>(name: string, options?: CollectionOptions): ICollection<T>;
  createCollection(name: string, options?: Record<string, any>): Promise<ICollection>;
  listCollections(): Promise<{name: string}[]>;
  dropCollection(name: string): Promise<boolean>;

  /**
   * A driver-specific administrative command. `db.command` on Mongo, raw SQL on PostgreSQL. It depends
   * on a capability and is not called from inside `packages/api/*`.
   */
  command?(command: Record<string, any>): Promise<any>;

  /**
   * Re-aligns a collection's **physical** schema after its logical definition has changed.
   *
   * A no-op in a document store: there is no schema and a new field appears on the first write. That is
   * why the method is optional — the same rationale as `ISupportsReadPlan` and `ISupportsIndexManager`:
   * we do not write a promise a driver will not keep.
   *
   * It is mandatory on a relational driver: when a bucket schema gains a field the table has to gain a
   * column, otherwise writing to that field is rejected with "is not a property of this bucket". This
   * registration **was missing** — `ISchemaManager` existed from the start but had no caller
   * inside `packages/api`, so creating a bucket worked while **updating** one silently never touched the
   * physical schema.
   *
   * `previous` is the logical definition describing the store's **current** state. It has to be given,
   * because the diff is computed against it: deriving it back from the physical table cannot tell apart
   * the column kinds that share `text` (`string`/`reference`/`textId`) and would produce a needless
   * `ALTER TYPE` on every update.
   */
  alignCollection?(name: string, previous?: LogicalSchema): Promise<void>;
}

/**
 * The logical definition `alignCollection` needs — written **structurally**.
 *
 * Importing the `Bucket` type risks a cycle through `database/driver` → `interface/bucket` → `database`;
 * the only thing the driver needs is `properties`.
 */
export interface LogicalSchema {
  properties?: Record<string, any>;
}

/**
 * Index management, kept **separate** from `IDatabase`: a driver that cannot serve it declares the gap
 * instead of having a mandatory method it does not keep — the same rationale as `ISupportsReadPlan`.
 */
export interface ISupportsIndexManager {
  indexes(collection: string): IIndexManager;
}

/** Schema management — meaningful on PostgreSQL only; on Mongo it amounts to opening a collection. */
export interface ISupportsSchemaManager {
  schema(): ISchemaManager;
}

/** A driver that serves every optional capability as well. */
export type IFullDatabase = IDatabase & ISupportsIndexManager & ISupportsSchemaManager;
