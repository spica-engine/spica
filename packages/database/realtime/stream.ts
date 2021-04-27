import {Sequence} from "./levenshtein";

export interface StreamChunk<T = any> {
  kind: ChunkKind;
  document?: T;
  sequence?: Sequence[];
}

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
