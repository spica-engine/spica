export type IndexDirection = 1 | -1;

/**
 * An index definition. Today it is stored as a Mongo index spec and shown in the panel
 * (`packages/interface/bucket/src/service.ts`). The field order is meaningful in a compound index, so it
 * is carried as an **array** rather than an object — no reliance on `jsonb`/JSON key order guarantees.
 */
export interface IndexSpec {
  keys: {field: string; direction: IndexDirection}[];
  name?: string;
}

export interface CreateIndexOptions {
  unique?: boolean;
  /** The partial index condition; compiled into a `WHERE` clause on PostgreSQL. */
  partialFilterExpression?: Record<string, any>;
  expireAfterSeconds?: number;
  /** No counterpart on PostgreSQL — `UnsupportedCapabilityError`. */
  sparse?: boolean;
  /** No counterpart on PostgreSQL — `UnsupportedCapabilityError`. */
  collation?: Record<string, any>;
}

export interface ExistingIndex {
  name: string;
  keys: {field: string; direction: IndexDirection}[];
  unique?: boolean;
  expireAfterSeconds?: number;
}

export interface IIndexManager {
  list(): Promise<ExistingIndex[]>;
  create(spec: IndexSpec, options?: CreateIndexOptions): Promise<string>;
  drop(name: string): Promise<void>;

  /**
   * This collection's retention period in seconds, or `undefined` when it is not set.
   *
   * **Why `list()` is not enough.** On MongoDB retention is a TTL **index**; on PostgreSQL it is a
   * sweeper registration (`nativeTTLIndex: false` declares that). Reading it through `list()` means
   * asserting the mechanism — the specs were looking for an index named `created_at_1` and no such
   * object exists on PG, nor should it.
   *
   * This read asks about the **feature**: "after how many seconds are this collection's records
   * deleted". Both backends can give the same answer and the specs are verified independently of the
   * mechanism.
   *
   * Adding the TTL to `list()` as a fake index was possible too, but it had two harms: reporting an
   * object that does not exist (`drop` cannot delete it) and `BucketService.updateIndexes` **trying to
   * drop it** as "not in the bucket definition".
   */
  ttlSeconds(): Promise<number | undefined>;
}
