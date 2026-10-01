import {Observable} from "rxjs";
import {Id} from "./id.js";

export type ChangeOperation = "insert" | "update" | "replace" | "delete" | "invalidate";

/**
 * Consumer progress, as a pair. **`seq` cannot be the watermark on its own**: it and `txid` are assigned
 * in the same `INSERT`, but across sessions a transaction with a high txid can get a low `seq`, and once
 * the `seq` watermark passes it that row never falls within a query again — measured as silent event loss
 * under parallel writers. Progress is read from `txid`, the order within a transaction from `seq`.
 */
export interface ResumeToken {
  /** PostgreSQL: `xid8`. MongoDB: opak. */
  txid: string;
  /** The event order within a transaction. */
  seq: string;
  /** The driver-specific opaque representation (Mongo's change stream `_id._data`). */
  opaque?: string;
}

export interface DatabaseChange<T = any> {
  operation: ChangeOperation;
  collection: string;
  documentId?: Id;
  /** The counterpart of `fullDocument: "updateLookup"`. */
  document?: T;
  /** The previous state on a delete or an update. */
  previousDocument?: T;
  /**
   * The changed fields — **name → new value**, not just the names: that map is what a database trigger
   * function already sees today, so narrowing it here would break every one of them.
   */
  updatedFields?: Record<string, unknown>;
  /** The removed fields — names only; there is no value anyway. */
  removedFields?: string[];
  token: ResumeToken;
}

export interface ChangeStreamOptions {
  resumeAfter?: ResumeToken;
  fullDocument?: "default" | "updateLookup";
  /**
   * Whether the previous state is wanted. **Precondition on Mongo:** the collection has to have been
   * opened with `changeStreamPreAndPostImages`; the PostgreSQL trigger already receives the `OLD` row.
   */
  fullDocumentBeforeChange?: "off" | "whenAvailable" | "required";
  maxAwaitTimeMS?: number;
  /**
   * The neutral counterpart of Mongo's `[{$match: {operationType: {$in: [...]}}}]`. The filter reaches the
   * driver: the `WHERE` of the outbox query on PostgreSQL, the pipeline on MongoDB.
   */
  operations?: ChangeOperation[];
  /**
   * Called once the stream is guaranteed to observe **subsequent** writes.
   *
   * On MongoDB the start point is set when the server runs the `aggregate`, which the driver dispatches
   * some milliseconds after `watch()` returns. A write landing in that window produces no event at all and
   * nothing reports it — the stream is healthy and simply stays silent. A caller that must not miss its own
   * next write waits for this first.
   */
  onReady?: () => void;
}

/**
 * The neutral event stream — the counterpart of `watch()`, which deliberately keeps emitting the raw Mongo
 * document. Separate from `ICollection` so that a driver not satisfying it is a declarable gap.
 */
export interface ISupportsChanges<T = any> {
  changes(options?: ChangeStreamOptions): Observable<DatabaseChange<T>>;
}
