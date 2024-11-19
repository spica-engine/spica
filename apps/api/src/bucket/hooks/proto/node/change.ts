import {hooks} from "@spica/api/src/bucket/hooks/proto";

function getChangeKind(kind: hooks.Change.Kind) {
  switch (kind) {
    case hooks.Change.Kind.INSERT:
      return "insert";
    case hooks.Change.Kind.DELETE:
      return "delete";
    case hooks.Change.Kind.UPDATE:
      return "update";
    default:
      throw new Error(`Invalid type received. ${hooks.Change.Kind[kind]}`);
  }
}

export class Change<T = unknown> {
  kind: "insert" | "delete" | "update" | "replace";
  bucket: string;
  documentKey: string;
  previous?: Partial<T>;
  current?: Partial<T>;

  constructor(change: hooks.Change) {
    this.kind = getChangeKind(change.kind);
    this.bucket = change.bucket;
    this.documentKey = change.documentKey;

    if (change.previous) {
      this.previous = JSON.parse(change.previous);
    }

    if (change.current) {
      this.current = JSON.parse(change.current);
    }
  }
}
