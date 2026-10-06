/**
 * The capability declaration. A surface missing on a backend is declared here and raises a clear error
 * rather than differing silently; the panel reads this and hides the interface in question.
 */
export interface DriverCapabilities {
  /** `mongodb` | `postgres` */
  readonly backend: string;
  readonly version: string;

  /**
   * Whether a raw Mongo JSON filter is accepted on `bucket/:id/data`.
   *
   * `"subset"` is a genuine third state, for the same reason `aggregationPipeline` has one: on PostgreSQL
   * the **measured closed set** (`$gt`, `$in`, `$and`, `$or`, `$regex`, …) compiles and answers correctly,
   * while an operator outside it is rejected by name. `false` claimed a refusal that nothing implements
   * and that the endpoint does not perform — measured on a real instance.
   */
  rawMongoFilter: boolean | "subset";
  /**
   * Aggregation pipeline support. `"subset"` is a genuine third state: PostgreSQL compiles
   * `$match`/`$sort`/`$skip`/`$limit`/`$project`/`$count` but does not support
   * `$lookup`/`$unwind`/`$group`/`$facet`. Saying `false` would be wrong (there are calls that work) and
   * so would `true` (the panel would open an unsupported interface).
   */
  aggregationPipeline: boolean | "subset";
  /** `system.profile` on Mongo; `pg_stat_statements` on PostgreSQL (a different interface). */
  queryProfiler: false | "system.profile" | "pg_stat_statements";
  /** Whether there is a native TTL index; without one the sweeper takes over. */
  nativeTTLIndex: boolean;
  indexOptions: {sparse: boolean; collation: boolean; partial: boolean};
  /** Direct database access for functions. */
  directAccessDevkit: false | "@spica-devkit/database" | "@spica-devkit/postgres";
  /** Real foreign key integrity (present on PostgreSQL, in the application layer on Mongo). */
  referentialIntegrity: boolean;
  /** The lifetime field count limit per bucket; ~1600 column slots on PostgreSQL. */
  maxLifetimeFieldsPerCollection: number | null;
  /** Whether a replica set is mandatory (on Mongo it is, for change streams). */
  requiresReplicaSet: boolean;
}

/** A Mongo profiler entry; meaningful when `queryProfiler === "system.profile"`. */
export interface ProfilerEntry {
  ns: string;
  op: string;
  millis: number;
  ts: Date;
  [field: string]: any;
}
