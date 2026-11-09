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
import {Orm} from "@spica-server/data-postgresql-orm";

type Describe = (bucketId: string) => BucketDescription;
type Row = Record<string, unknown>;
type Property = Record<string, any>;

export async function fetchRowSet(
  orm: Orm,
  describe: Describe,
  bucketId: string,
  key: unknown,
  resolve: string[] = []
): Promise<RowSet> {
  const {definition, metadata} = describe(bucketId);
  const [main] = await orm.table(metadata.main.name).rowsWhere(metadata.primaryKey.column, key);

  const children: Record<string, Row[]> = {};
  for (const table of metadata.children) {
    children[fieldKey(table.path)] = await orm
      .table(table.name)
      .rowsWhere(SYSTEM_COLUMNS.parent, key);
  }

  const joined: Record<string, RowSet | RowSet[] | null> = {};
  for (const field of resolve) {
    const property = (definition.properties as Record<string, Property>)[field];
    if (property.relationType == "onetomany") {
      const keys = children[field].map(row => row[SYSTEM_COLUMNS.target]);
      joined[field] = await Promise.all(
        keys.map(targetKey => fetchRowSet(orm, describe, property.bucketId, targetKey))
      );
    } else {
      const targetKey = main[columnName([field])];
      joined[field] =
        targetKey == null ? null : await fetchRowSet(orm, describe, property.bucketId, targetKey);
    }
  }

  return {main, children, ...(resolve.length ? {joined} : {})};
}
