import {ResourceFilterSpec, WhereCondition} from "@spica-server/interface-data";
import {Observable} from "rxjs";

export enum ChunkKind {
  Error = -1,
  Initial = 0,
  EndOfInitial = 1,
  Insert = 2,
  Delete = 3,
  Expunge = 4,
  Update = 5,
  Replace = 6,
  Order = 7,
  Response = 8
}

export interface Document {
  [key: string]: any;
}

export interface StreamChunk<T extends Document> {
  kind: ChunkKind;
  document?: T;
  sequence?: Sequence[];
}

export interface Sequence {
  kind: SequenceKind;
  item: any;
  at: number;
  with?: any;
}

export enum SequenceKind {
  Delete = 0,
  Substitute = 1,
  Insert = 2
}

export type FilterLanguage = "json" | "expression";

export interface RealtimeOptions {
  /**
   * A MongoDB filter object, or a Spica expression for engines that filter with expressions.
   */
  filter?: object | string;
  resourceFilter?: ResourceFilterSpec;
  sort?: {[field: string]: -1 | 1};
  skip?: number;
  limit?: number;
  /**
   * Restricts a bucket's documents to the ones its read rule allows `user`.
   */
  applyAcl?: boolean;
  user?: unknown;
  hashSecret?: string;
  /**
   * Conditions the gateway builds itself, for collections that are not filtered by clients.
   */
  where?: {[field: string]: WhereCondition};
  createdBetween?: {from: Date; to: Date};
}

export interface Realtime {
  /**
   * What a client's `filter` is written in: a MongoDB filter, or a Spica expression.
   */
  readonly filterLanguage: FilterLanguage;
  find<T extends Document = any>(
    name: string,
    options?: RealtimeOptions
  ): Observable<StreamChunk<T>>;
  doesEmitterExist(name: string, options: RealtimeOptions): boolean;
  removeEmitter(name: string, options: RealtimeOptions): void;
}

export const REALTIME = Symbol.for("SPICA_REALTIME");
