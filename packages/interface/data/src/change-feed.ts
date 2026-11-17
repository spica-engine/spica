import {Observable} from "rxjs";

export type ChangeOperation = "insert" | "update" | "replace" | "delete" | "drop";

export interface ChangeEvent<T = any> {
  /**
   * Equal for the same change on every replica; replicas deduplicate work on it.
   */
  id: string;
  operation: ChangeOperation;
  collection: string;
  key?: string;
  document?: T;
  previousDocument?: T;
  changes?: {
    updated: {[key: string]: any};
    removed: string[];
  };
}

export interface ChangeFeedOptions {
  /**
   * Only these operations are emitted; every operation when omitted.
   */
  operations?: ChangeOperation[];
  /**
   * Attaches the document as it is after updates, not only after inserts and replacements.
   */
  document?: "current";
  /**
   * Attaches the document as it was before the change when the collection records it.
   */
  beforeChange?: "whenAvailable";
  /**
   * The subscriber needs only the operation and the key, so the engine may skip reading documents.
   */
  keysOnly?: boolean;
}

export interface ChangeFeed {
  /**
   * Emits the changes of the collection from subscription on; unsubscribing closes the feed.
   */
  watch<T = any>(collection: string, options?: ChangeFeedOptions): Observable<ChangeEvent<T>>;
}

export const CHANGE_FEED = Symbol.for("SPICA_DATA_CHANGE_FEED");
