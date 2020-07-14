export interface Sequence {
  kind: SequenceKind;
  item: string;
  at: number;
  with?: string;
}
export enum SequenceKind {
  Delete = 0,
  Substitute = 1,
  Insert = 2
}

export interface StreamChunk<T = any> {
  kind: ChunkKind;
  document?: T;
  sequence?: Sequence[];
}
export enum ChunkKind {
  Initial = 0,
  EndOfInitial = 1,
  Insert = 2,
  Delete = 3,
  Expunge = 4,
  Update = 5,
  Replace = 6,
  Order = 7
}
