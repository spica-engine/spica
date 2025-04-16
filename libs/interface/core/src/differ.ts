export enum ChangeKind {
  Edit = 1,
  Delete = 2,
  Add = 0
}

export type ChangePath = string | number;
export type ChangePaths = ChangePath[];

export interface Change {
  kind: ChangeKind;
  path: ChangePaths;
  patches?: Patch[];
}

export class Patch {
  diffs: [number, string][];
  start1: number | null;
  start2: number | null;
  length1: number;
  length2: number;
}

export interface SchemaChange extends Change {
  lastPath: ChangePaths;
}
