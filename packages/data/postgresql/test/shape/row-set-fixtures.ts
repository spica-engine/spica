/*
 * Reads a row set by hand, so shape/row-layout.spec.ts can change the stored rows before they are
 * shaped. BUCKET_QUERY reads and shapes in one step, so it cannot do that.
 */
import {
  BucketDescription,
  columnName,
  fieldKey,
  RowSet,
  SYSTEM_COLUMNS
} from "@spica-server/data-postgresql";
import pg from "pg";

type Describe = (bucketId: string) => BucketDescription;
type Row = Record<string, unknown>;
type Property = Record<string, any>;

const quote = (name: string) => `"${name}"`;

export async function fetchRowSet(
  pool: pg.Pool,
  describe: Describe,
  bucketId: string,
  key: unknown,
  resolve: string[] = []
): Promise<RowSet> {
  const {definition, metadata} = describe(bucketId);
  const {rows} = await pool.query(
    `SELECT * FROM ${quote(metadata.main.name)} WHERE ${quote(metadata.primaryKey.column)} = $1`,
    [key]
  );
  const main = rows[0];

  const children: Record<string, Row[]> = {};
  for (const table of metadata.children) {
    const result = await pool.query(
      `SELECT * FROM ${quote(table.name)} WHERE ${quote(SYSTEM_COLUMNS.parent)} = $1`,
      [key]
    );
    children[fieldKey(table.path)] = result.rows;
  }

  const joined: Record<string, RowSet | RowSet[] | null> = {};
  for (const field of resolve) {
    const property = (definition.properties as Record<string, Property>)[field];
    if (property.relationType == "onetomany") {
      const keys = children[field].map(row => row[SYSTEM_COLUMNS.target]);
      joined[field] = await Promise.all(
        keys.map(targetKey => fetchRowSet(pool, describe, property.bucketId, targetKey))
      );
    } else {
      const targetKey = main[columnName([field])];
      joined[field] =
        targetKey == null ? null : await fetchRowSet(pool, describe, property.bucketId, targetKey);
    }
  }

  return {main, children, ...(resolve.length ? {joined} : {})};
}
