import {FindOptions} from "@spica-server/interface-database";
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

export interface Realtime {
  find<T extends Document = any>(
    name: string,
    options?: FindOptions<T>
  ): Observable<StreamChunk<T>>;
  doesEmitterExist(name: string, options: FindOptions<any>): boolean;
  removeEmitter(name: string, options: FindOptions<any>): void;
}

export const REALTIME = Symbol.for("SPICA_REALTIME");
