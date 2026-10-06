import {Pool} from "pg";
import {UnsupportedCapabilityError} from "@spica-server/database-driver";

/**
 * The TTL sweeper — because PostgreSQL has no native TTL index (`nativeTTLIndex: false`).
 *
 * In MongoDB `expireAfterSeconds` is an index property and the server does the deleting. PostgreSQL has
 * no counterpart; `pg_cron` is an extension and is not guaranteed on managed servers (we do not
 * make an extension mandatory). So the deleting happens on the application side, from a single timer.
 *
 * `upsertTTLIndex` **deliberately raises** on PG: the contract test requires that a declared absence of
 * a capability must not silently look successful. The call sites look at the capability flag and use
 * `register()` instead.
 */
export interface TtlRegistration {
  /**
   * Did the **user** ask for this registration, or a service?
   *
   * Registrations that arrive through `createIndex({...}, {expireAfterSeconds})` are part of the bucket
   * definition and `IIndexManager.list()` **has to** report them: `BucketService.updateIndexes` compares
   * the requested set with the existing one by name, and if they are not reported, removing the TTL from
   * the definition does not delete them.
   *
   * The ones that arrive through `upsertTTLIndex` are part of no definition; reporting them would mean
   * `updateIndexes` trying to **drop** them as "not in the definition".
   */
  indexName?: string;
  /** The table name in the `spica` schema. */
  table: string;
  /** A `timestamptz` column; the row is deleted `seconds` after this value. */
  field: string;
  seconds: number;
  /**
   * The key column used for chunked deletion. Not every system table carries an `_id` — the CDC
   * outbox's key is `seq`.
   */
  key?: string;
}

export interface TtlSweeperOptions {
  schema: string;
  /** The sweep interval. Mongo's TTL monitor also runs once every 60 seconds. */
  intervalMs?: number;
  /**
   * The upper bound of what a single round deletes. An unbounded `DELETE` can take a long time on a
   * table that has built up and disturb autovacuum and replication lag; we delete in chunks.
   */
  batchSize?: number;
  onError?: (error: Error) => void;
}

/**
 * Turns a TTL index into a sweeper registration — `ICollection.createIndex` and `IIndexManager.create`
 * **both** land here.
 *
 * Patching the two separately led to a real bug: when I fixed only the collection path,
 * `BucketService.updateIndexes` was still being rejected, because it uses `IIndexManager`.
 */
export function registerTtlIndex(
  sweeper: TtlSweeper,
  table: string,
  indexName: string,
  keys: {field: string}[],
  seconds: number
): void {
  if (keys.length !== 1) {
    throw new UnsupportedCapabilityError("a compound TTL index", "postgres");
  }

  sweeper.register({indexName, table, field: keys[0].field, seconds});
}

export class TtlSweeper {
  private registrations = new Map<string, TtlRegistration>();
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private pool: Pool,
    private options: TtlSweeperOptions
  ) {}

  register(registration: TtlRegistration): void {
    this.registrations.set(`${registration.table}.${registration.field}`, registration);
  }

  /** A table's **named** (user-defined) TTL registrations. */
  namedRegistrations(table: string): TtlRegistration[] {
    return [...this.registrations.values()].filter(
      registration => registration.table === table && registration.indexName
    );
  }

  /** Removal by name — `IIndexManager.drop()` lands on this path. */
  unregisterByName(table: string, indexName: string): boolean {
    for (const [key, registration] of this.registrations) {
      if (registration.table === table && registration.indexName === indexName) {
        this.registrations.delete(key);
        return true;
      }
    }
    return false;
  }

  unregister(table: string, field: string): void {
    this.registrations.delete(`${table}.${field}`);
  }

  /**
   * A table's retention period in seconds, or `undefined` when there is no registration.
   *
   * The PG-side source of `IIndexManager.ttlSeconds()`. Because the field name is fixed (`created_at`)
   * there is one registration per table; the first match is returned all the same, because the contract
   * asks for a single number, "this collection's retention period".
   */
  retentionSeconds(table: string): number | undefined {
    for (const registration of this.registrations.values()) {
      if (registration.table === table) return registration.seconds;
    }
    return undefined;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.sweep().catch(error => this.options.onError?.(error));
    }, this.options.intervalMs ?? 60_000);
    this.timer.unref?.();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** One sweep round; returns the number of rows deleted. The tests call it directly. */
  async sweep(): Promise<number> {
    // Overlapping rounds would lock the same rows and wait on each other.
    if (this.running) return 0;
    this.running = true;
    try {
      let deleted = 0;
      for (const registration of this.registrations.values()) {
        deleted += await this.sweepOne(registration);
      }
      return deleted;
    } finally {
      this.running = false;
    }
  }

  private async sweepOne(registration: TtlRegistration): Promise<number> {
    const {table, field, seconds, key = "_id"} = registration;
    const qualified = `${this.options.schema}."${table}"`;
    const batchSize = this.options.batchSize ?? 10_000;

    let total = 0;
    for (;;) {
      const {rowCount} = await this.pool.query(
        `DELETE FROM ${qualified}
         WHERE "${key}" IN (
           SELECT "${key}" FROM ${qualified}
           WHERE "${field}" < now() - ($1 || ' seconds')::interval
           LIMIT $2
         )`,
        [String(seconds), batchSize]
      );
      total += rowCount ?? 0;
      if ((rowCount ?? 0) < batchSize) return total;
    }
  }
}
