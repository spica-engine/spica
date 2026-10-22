import {Observable} from "rxjs";
import {Id} from "./id.js";

export type ChangeOperation = "insert" | "update" | "replace" | "delete" | "drop";

export interface ChangeEvent<T = any> {
  /**
   * Resumes the feed after this change; equal for the same change on every replica.
   */
  _id: {_data: string};
  operationType: ChangeOperation | string;
  ns?: {db?: string; coll: string};
  documentKey?: {_id: Id};
  updateDescription?: {
    updatedFields?: {[key: string]: any};
    removedFields?: string[];
  };
  fullDocument?: T;
  fullDocumentBeforeChange?: T;
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
}

export interface ChangeFeed {
  /**
   * Emits the changes of the collection from subscription on; unsubscribing closes the feed.
   */
  watch<T = any>(collection: string, options?: ChangeFeedOptions): Observable<ChangeEvent<T>>;
}

export const CHANGE_FEED = Symbol.for("SPICA_DATA_CHANGE_FEED");
