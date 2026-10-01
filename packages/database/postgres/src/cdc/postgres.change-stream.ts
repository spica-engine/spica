import {Client, Pool} from "pg";
import {Observable} from "rxjs";
import {
  ChangeOperation,
  ChangeStreamOptions,
  DatabaseChange,
  ResumeToken
} from "@spica-server/database-driver";
import {CHANGES_CHANNEL, CHANGES_TABLE} from "./changes-schema.js";
import {SYSTEM_SCHEMA} from "../schema/naming.js";

const qualified = `${SYSTEM_SCHEMA}."${CHANGES_TABLE}"`;

/**
 * Raised when a resume is requested with a token older than the retention period — MongoDB's
 * `ChangeStreamHistoryLost`. Resuming from now instead would hide the lost events.
 */
export class ChangeHistoryLostError extends Error {
  readonly code = "ChangeStreamHistoryLost";
  constructor(token: ResumeToken) {
    super(
      `Resume token (txid=${token.txid}, seq=${token.seq}) is older than the retained change history.`
    );
  }
}

export interface PostgresChangeStreamOptions {
  /**
   * A separate connection for `LISTEN`: it is session bound, so the pool loses the registration when the
   * connection goes back, and PgBouncer's transaction mode cannot do it at all. Optional — without it only
   * polling runs and correctness is unchanged.
   *
   * **A function may be given instead of a client**, and an owner whose connection can drop should give
   * one: `LISTEN` dies with its session and `pg`'s `Client` does not reconnect, so recovery means a *new*
   * client. Handed a fixed object, this class would keep listening on a dead one and silently stay on the
   * poll interval for the life of the process.
   */
  listenClient?: Client | (() => Client | undefined);
  /** The interval of the fallback round that runs even when no notification arrives. */
  pollIntervalMs?: number;
  /** The upper bound of what a single round reads. */
  batchSize?: number;
  onError?: (error: Error) => void;
}

interface Row {
  seq: string;
  txid: string;
  coll: string;
  op: ChangeOperation;
  doc_id: string;
  full_doc: Record<string, unknown> | null;
  before_doc: Record<string, unknown> | null;
  updated_fields: Record<string, unknown> | null;
  removed_fields: string[] | null;
}

/**
 * The CDC consumer.
 *
 * **The watermark is on `txid`, not on `seq`.** Each round reads
 * `WHERE txid >= :last AND txid < pg_snapshot_xmin(pg_current_snapshot())`: every transaction below `xmin`
 * has finished and the rolled-back ones are already invisible through MVCC, so no row can land inside a
 * window after it was read. `seq` carries only the order within one transaction.
 *
 * **The watermark is per subscriber.** A shared one would need a catch-up read plus buffering for
 * subscribers joining at a different `resumeAfter`; instead each runs its own narrow indexed range scan and
 * only the notification signal is shared. The `realtime` service already reduces this to one stream per
 * collection.
 */
export class PostgresChangeStream {
  private listeners = new Set<() => void>();
  private listening = false;

  /**
   * Set when the `LISTEN` registration may no longer exist. Nothing breaks loudly — polling keeps the stream
   * correct — but the latency silently drops to the poll interval and stays there.
   *
   * Recovery is a retry, not a reconnect: the client belongs to the caller, so each polling round re-issues
   * the idempotent `LISTEN` and gives up until the next one.
   */
  private relistenNeeded = false;

  /**
   * The handlers this instance attached to the `LISTEN` client, kept so `stop()` can take them off again.
   * The client is the caller's and callers do share one, so an instance that leaves its handlers behind
   * keeps receiving notifications and drains against a pool that is already closed.
   */
  private attached?: {
    client: Client;
    notification: (notification: {channel: string}) => void;
    error: (error: unknown) => void;
  };

  /** The client as it is **right now**; a provider may hand back a different one after a reconnect. */
  private resolveListenClient(): Client | undefined {
    const option = this.options.listenClient;
    return typeof option === "function" ? option() : option;
  }

  constructor(
    private pool: Pool,
    private options: PostgresChangeStreamOptions = {}
  ) {}

  /** The `LISTEN` registration; when no connection was given it silently falls back to polling. */
  async start(): Promise<void> {
    const client = this.resolveListenClient();
    if (!client || this.listening) return;
    this.listening = true;

    await this.attachTo(client);
  }

  /** Attaches the handlers to `client` and registers `LISTEN` on it. */
  private async attachTo(client: Client): Promise<void> {
    this.attached = {
      client,
      notification: notification => {
        if (notification.channel !== CHANGES_CHANNEL) return;
        for (const listener of this.listeners) listener();
      },
      error: error => {
        this.relistenNeeded = true;
        this.options.onError?.(error as Error);
      }
    };
    client.on("notification", this.attached.notification as any);
    client.on("error", this.attached.error as any);

    await client.query(`LISTEN "${CHANGES_CHANNEL}"`);
  }

  /** Takes this instance's handlers off the client they were attached to. */
  private detach(): void {
    if (!this.attached) return;
    this.attached.client.off("notification", this.attached.notification as any);
    this.attached.client.off("error", this.attached.error as any);
    this.attached = undefined;
  }

  /**
   * Re-issues `LISTEN` when the previous registration may have been lost. A failure is swallowed on purpose:
   * the connection is still down, polling keeps the stream correct, and logging once per poll would drown
   * the real error the owner already saw.
   */
  private async relisten(): Promise<void> {
    if (!this.relistenNeeded || !this.listening) return;

    const client = this.resolveListenClient();
    if (!client) {
      this.relistenNeeded = false;
      return;
    }

    try {
      // A replacement connection needs the handlers as well, not just the registration.
      if (this.attached && this.attached.client !== client) {
        this.detach();
        await this.attachTo(client);
      } else {
        await client.query(`LISTEN "${CHANGES_CHANNEL}"`);
      }
      this.relistenNeeded = false;
    } catch {
      // Still down; the next round tries again.
    }
  }

  stop(): Promise<void> {
    this.listeners.clear();
    if (!this.listening) return Promise.resolve();
    this.listening = false;

    // Off the client the handlers were actually attached to — after a reconnect that is not the one a fresh
    // `resolveListenClient()` would return.
    this.detach();

    /**
     * **No `UNLISTEN`.** The registration belongs to the connection, which can be shared, so issuing it here
     * would silence every other live driver on the same client. With no handler attached the notifications
     * are simply dropped.
     */
    return Promise.resolve();
  }

  /** The current boundary: every transaction below it counts as finished. */
  private async frontier(): Promise<string> {
    const {rows} = await this.pool.query<{x: string}>(
      `SELECT pg_snapshot_xmin(pg_current_snapshot())::text AS x`
    );
    return rows[0].x;
  }

  /**
   * A single read round; the tests call it directly, so verification does not depend on the timer.
   *
   * **Ordering is by `seq` within the window, not by `(txid, seq)`.** Completeness comes from the `txid`
   * range condition and the `ORDER BY` only sets the delivery order — and since `txid` is not the commit
   * order, ordering by it breaks a single document's event chain.
   *
   * `skip` drops the rows already delivered from that window: a row is skipped only when it belongs to the
   * window **and** is behind its delivery point. Looking at `seq` alone would drop rows from later windows.
   */
  async readRound(
    from: string,
    filter: {collection?: string; operations?: ChangeOperation[]} = {},
    skip?: ResumeToken
  ): Promise<{changes: DatabaseChange[]; next: string; more?: ResumeToken}> {
    const to = await this.frontier();
    if (BigInt(to) <= BigInt(from)) return {changes: [], next: from};

    const params: unknown[] = [from, to];
    const conditions = [`"txid" >= $1::xid8`, `"txid" < $2::xid8`];

    if (filter.collection) {
      params.push(filter.collection);
      conditions.push(`"coll" = $${params.length}`);
    }
    if (filter.operations?.length) {
      params.push(filter.operations);
      conditions.push(`"op" = ANY($${params.length}::text[])`);
    }

    const batchSize = this.options.batchSize ?? 1000;
    params.push(batchSize);

    const {rows} = await this.pool.query<Row>(
      `SELECT "seq"::text, "txid"::text, "coll", "op", "doc_id",
              "full_doc", "before_doc", "updated_fields", "removed_fields"
         FROM ${qualified}
        WHERE ${conditions.join(" AND ")}
        ORDER BY "seq"
        LIMIT $${params.length}`,
      params
    );

    const kept = skip ? rows.filter(row => !alreadyDelivered(row, skip)) : rows;
    const changes = kept.map(row => toChange(row, from, to));

    // A full batch means the window is not finished: the watermark is NOT advanced, or the rows outside the
    // `LIMIT` are lost for good.
    if (rows.length === batchSize) {
      const last = rows[rows.length - 1];
      return {changes, next: from, more: {txid: from, seq: last.seq, opaque: to}};
    }

    return {changes, next: to};
  }

  /**
   * The neutral event stream. With `resumeAfter` the round starts from that token's `txid` and skips what is
   * at or behind its `seq`, so the token itself is not delivered twice.
   */
  changes<T = any>(
    collection: string | undefined,
    options: ChangeStreamOptions & {operations?: ChangeOperation[]} = {}
  ): Observable<DatabaseChange<T>> {
    return new Observable<DatabaseChange<T>>(observer => {
      let closed = false;
      let watermark: string | undefined;
      let skip: ResumeToken | undefined = options.resumeAfter;
      let draining = false;
      let pending = false;

      let announced = false;
      /**
       * Readiness is the moment the **watermark** is fixed, not the moment `subscribe` was called: the
       * frontier is read asynchronously inside the first round, and announcing earlier would let a caller
       * that waits for `onReady` and then writes miss its own write.
       */
      const announceReady = () => {
        if (announced) return;
        announced = true;
        options.onReady?.();
      };

      const drain = async () => {
        if (draining) {
          pending = true;
          return;
        }
        draining = true;
        try {
          while (!closed) {
            if (watermark === undefined) {
              if (skip) await this.assertRetained(skip);
              watermark = skip ? skip.txid : await this.frontier();
              announceReady();
            }

            const round = await this.readRound(
              watermark,
              {collection, operations: options.operations},
              skip
            );
            watermark = round.next;
            // When the batch is full, continue from the same window; when it is not, the skip information is exhausted.
            skip = round.more;

            for (const change of round.changes) {
              if (closed) break;
              observer.next(change as DatabaseChange<T>);
            }

            if (round.more) continue;
            if (!pending) break;
            pending = false;
          }
        } catch (error) {
          observer.error(error);
        } finally {
          draining = false;
        }
      };

      const listener = () => {
        void this.relisten();
        void drain();
      };
      this.listeners.add(listener);

      const timer = setInterval(listener, this.options.pollIntervalMs ?? 500);
      timer.unref?.();
      void drain();

      return () => {
        closed = true;
        clearInterval(timer);
        this.listeners.delete(listener);
      };
    });
  }

  /**
   * Whether the token is still inside the retained history: if the smallest `txid` left is greater than the
   * token's, the events in between were swept and resuming would skip them silently. An empty outbox proves
   * no loss — there may have been no events at all.
   */
  private async assertRetained(token: ResumeToken): Promise<void> {
    const {rows} = await this.pool.query<{oldest: string | null}>(
      `SELECT min("txid")::text AS oldest FROM ${qualified}`
    );
    const oldest = rows[0].oldest;
    if (oldest === null) return;
    if (BigInt(oldest) > BigInt(token.txid)) throw new ChangeHistoryLostError(token);
  }
}

/**
 * A row → a neutral event. **The token carries the window, not the row's own `txid`**: start, end and the
 * delivery point within it. That is what makes a resume exact — the delivered rows of the same window are
 * skipped while later windows' rows, even with a smaller `seq`, are not.
 */
function toChange(row: Row, windowStart: string, windowEnd: string): DatabaseChange {
  const change: DatabaseChange = {
    operation: row.op,
    collection: row.coll,
    documentId: row.doc_id.trim() as any,
    token: {txid: windowStart, seq: row.seq, opaque: windowEnd}
  };

  if (row.full_doc) change.document = row.full_doc as any;
  if (row.before_doc) change.previousDocument = row.before_doc as any;
  if (row.updated_fields) change.updatedFields = row.updated_fields;
  if (row.removed_fields) change.removedFields = row.removed_fields;

  return change;
}

/**
 * Has the row already been delivered in the round `skip` points at? **Both conditions are needed together**:
 * `seq` alone would drop rows with a small `seq` that come from later windows.
 */
function alreadyDelivered(row: Row, skip: ResumeToken): boolean {
  if (BigInt(row.seq) > BigInt(skip.seq)) return false;
  if (!skip.opaque) return true;
  return BigInt(row.txid) < BigInt(skip.opaque);
}
