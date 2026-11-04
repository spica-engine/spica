import {quote, Session} from "@spica-server/data-postgresql-orm";
import {fieldKey, RowSet} from "../../shape/index.js";
import {BucketMetadata, SYSTEM_COLUMNS} from "../../schema/index.js";

type Row = Record<string, unknown>;

/**
 * One query per child table for the whole page, grouped by the row that owns each child.
 */
export async function loadRowSets(
  session: Session,
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
      const {rows: found} = await session.raw(
        `SELECT * FROM ${quote(table.name)} WHERE ${quote(SYSTEM_COLUMNS.parent)} = ANY($1::${primaryKey.type}[])`,
        [keys]
      );
      for (const child of found) {
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
