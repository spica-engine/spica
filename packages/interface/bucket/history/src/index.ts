import {Id} from "@spica-server/interface-data";
import {Change} from "@spica-server/interface-core";
import {Bucket, BucketDocument} from "@spica-server/interface-bucket";

export interface History {
  _id?: string | Id;
  bucket_id?: Id;
  document_id?: Id;
  title?: string;
  changes?: Change[];
  date?: any;
}

export interface HistorySummary {
  _id: Id;
  date: Date;
  changes: number;
}

export interface HistoryRepository {
  /**
   * Records the changes between the document versions, if any, keeping the latest ten per document.
   */
  createHistory(bucketId: Id, previous: BucketDocument, current: BucketDocument): Promise<unknown>;
  /**
   * Drops recorded changes that the schema change made meaningless.
   */
  updateHistories(previous: Bucket, current: Bucket): Promise<unknown>;
  getDocument(bucketId: Id, documentId: Id): Promise<BucketDocument | null>;
  findSummaries(bucketId: Id, documentId: Id): Promise<HistorySummary[]>;
  /**
   * Resolves to the histories of the document from the given one to the latest, newest first.
   */
  findSince(bucketId: Id, documentId: Id, historyId: Id): Promise<History[]>;
  deleteByBucket(bucketId: Id): Promise<number>;
  deleteByDocument(documentId: Id): Promise<number>;
}

export const HISTORY_REPOSITORY = Symbol.for("HISTORY_REPOSITORY");
