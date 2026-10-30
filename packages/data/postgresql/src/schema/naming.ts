import * as crypto from "crypto";

export const MAX_IDENTIFIER_BYTES = 63;

const HASH_LENGTH = 8;
const KEPT_BYTES = MAX_IDENTIFIER_BYTES - HASH_LENGTH - 1;

export const SYSTEM_COLUMNS = {
  parent: "_parent",
  position: "_position",
  locale: "_locale",
  value: "_value",
  source: "_source",
  target: "_target"
} as const;

export type ConstraintKind = "pk" | "fk" | "uq" | "ck" | "ix";

export class NamingError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join("; "));
  }
}

function truncateBytes(value: string, limit: number) {
  let kept = "";
  let bytes = 0;
  for (const char of value) {
    bytes += Buffer.byteLength(char);
    if (bytes > limit) {
      break;
    }
    kept += char;
  }
  return kept;
}

export function fit(logicalName: string) {
  if (Buffer.byteLength(logicalName) <= MAX_IDENTIFIER_BYTES) {
    return logicalName;
  }
  const hash = crypto.createHash("sha256").update(logicalName).digest("hex").slice(0, HASH_LENGTH);
  return `${truncateBytes(logicalName, KEPT_BYTES)}_${hash}`;
}

export const mainTableName = (bucketId: string) => fit(`bucket_${bucketId}`);

export const columnName = (path: string[]) => fit(path.join("__"));

export const fieldTableName = (bucketId: string, path: string[]) =>
  fit(`bucket_${bucketId}__${path.join("__")}`);

export const constraintName = (table: string, columns: string[], kind: ConstraintKind) =>
  fit(`${table}_${columns.join("_")}_${kind}`);

export interface NamedIdentifier {
  scope: string;
  name: string;
  logical: string;
}

export function assertUnique(identifiers: NamedIdentifier[]) {
  const seen = new Map<string, NamedIdentifier>();
  const problems: string[] = [];
  for (const identifier of identifiers) {
    const key = `${identifier.scope}\0${identifier.name}`;
    const first = seen.get(key);
    if (first) {
      problems.push(
        `"${first.logical}" and "${identifier.logical}" both map to "${identifier.name}" in ${identifier.scope}.`
      );
    } else {
      seen.set(key, identifier);
    }
  }
  if (problems.length) {
    throw new NamingError(problems);
  }
}
