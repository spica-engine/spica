import {fieldKey, RowSet} from "../../shape/index.js";
import {BucketMetadata, SYSTEM_COLUMNS} from "../../schema/index.js";
import {BucketReads} from "./reads.js";

type Row = Record<string, unknown>;

export async function loadRowSets(
  reads: Pick<BucketReads, "childRows">,
  metadata: BucketMetadata,
  rows: Row[],
  skip: (rootProperty: string) => boolean
): Promise<RowSet[]> {
  const {primaryKey} = metadata;
  const keys = rows.map(row => row[primaryKey.column]);
  const children = new Map<string, Record<string, Row[]>>();

  if (keys.length) {
    for (const table of metadata.children) {
      if (skip(table.path[0])) {
        continue;
      }
      for (const child of await reads.childRows(table.name, primaryKey.type, keys)) {
        const owner = String(child[SYSTEM_COLUMNS.parent]);
        const byTable = children.get(owner) ?? {};
        (byTable[fieldKey(table.path)] ??= []).push(child);
        children.set(owner, byTable);
      }
    }
  }

  return rows.map(main => ({
    main,
    children: children.get(String(main[primaryKey.column])) ?? {}
  }));
}
