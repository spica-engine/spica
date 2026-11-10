import {ResourceFilterSpec} from "@spica-server/interface-data";
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
}

export interface Realtime {
  find<T extends Document = any>(
    name: string,
    options?: RealtimeOptions
  ): Observable<StreamChunk<T>>;
  doesEmitterExist(name: string, options: RealtimeOptions): boolean;
  removeEmitter(name: string, options: RealtimeOptions): void;
}

export const REALTIME = Symbol.for("SPICA_REALTIME");
