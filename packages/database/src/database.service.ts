// `DatabaseService` is the neutral DI token both drivers sit behind. Its surface is deliberately narrow;
// mongodb's own types (`Collection<T>`, `ListCollectionsCursor`, `Admin`, `ProfilingLevel`) would make it
// impossible for a second driver to get behind it.
//
// What the narrowing cost, measured against the call sites:
//
// - `listCollections` (the one returning a Mongo cursor) and `admin()` have **no consumer at all**. The
//   plan's note that "only `apps/migrate` uses `admin()`" was wrong; `apps/migrate` takes a raw
//   `mongodb.Db` (`apps/migrate/src/migrate.ts:137`) and never sees this token. Both were removed.
// - `collections()` is used in three places and all three read only `.collectionName`
//   (`webhook.controller.ts:39`, `webhook/src/schema.ts:83`, `function/src/engine.ts:298`) →
//   `listCollections(): Promise<{name}[]>` is enough.
// - `command()` is used in one place: `status/src/controller.ts:38` → `{ping: 1}`, that is a health
//   check → the neutral `ping()`.
// - There are **7** `this.db.*` calls in total in `packages/api` production code, all of them on the
//   surface below.
import {
  CollectionOptions,
  DriverCapabilities,
  ICollection,
  LogicalSchema
} from "@spica-server/database-driver";

/**
 * The driver-independent database surface and the NestJS DI token.
 *
 * It has to stay a class: it is used as a token in 44 places, as `provide: DatabaseService` /
 * `inject: [DatabaseService]`. There is a **real instance** behind it (`MongoDatabase` or
 * the PostgreSQL driver); in Phases 1–5 there was a `client.db(name) as DatabaseService` cast, so there
 * was no subclass instance at all.
 */
export abstract class DatabaseService {
  /** The Mongo change stream's wait time; on PostgreSQL it corresponds to the polling interval. */
  changeStreamAwaitTimeMS?: number;

  abstract readonly databaseName: string;

  abstract readonly capabilities: DriverCapabilities;

  abstract collection<T = any>(name: string, options?: CollectionOptions): ICollection<T>;

  abstract createCollection<T = any>(
    name: string,
    options?: Record<string, any>
  ): Promise<ICollection<T>>;

  /**
   * The collection names. It gives `{name}` instead of Mongo's `Collection[]` — all three consumers read
   * the name only, the rest was leakage.
   */
  abstract listCollections(): Promise<{name: string}[]>;

  abstract dropCollection(name: string): Promise<boolean>;

  /** A health check. `command({ping:1})` on Mongo, `SELECT 1` on PostgreSQL. */
  abstract ping(): Promise<void>;

  /**
   * Releases whatever the driver opened. Optional, because a service handed a connection it does not own
   * has nothing to release — the test harness shares one connection across modules on purpose.
   */
  close?(): Promise<void>;

  /**
   * The query profiler level. It depends on the capability declared with
   * `DriverCapabilities.queryProfiler`; a driver that does not provide it throws
   * `UnsupportedCapabilityError` (no staying silent). Only three specs use it.
   */
  abstract setProfilingLevel(level: string): Promise<unknown>;

  /**
   * A driver-specific administrative command — `db.command` on Mongo, raw SQL on PostgreSQL. It is not
   * called from inside `packages/api`.
   */
  command?(command: Record<string, any>): Promise<any>;

  /**
   * Aligns the physical schema after the logical schema has changed. It has no counterpart in a document
   * store, so it is optional — the rationale is in `IDatabase.alignCollection`.
   */
  alignCollection?(name: string, previous?: LogicalSchema): Promise<void>;
}
