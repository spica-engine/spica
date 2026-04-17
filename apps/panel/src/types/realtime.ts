// Mirrors packages/interface/realtime/src/index.ts
// Duplicated to keep the panel build independent of backend packages.

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
  Response = 8,
}

export interface StreamChunk<T extends Record<string, any> = Record<string, any>> {
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
  Insert = 2,
}
