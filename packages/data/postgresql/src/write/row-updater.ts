import {quote, Session} from "@spica-server/data-postgresql-orm";
import {Bucket} from "@spica-server/interface-bucket";
import {BucketMetadata, ColumnMetadata, SYSTEM_COLUMNS} from "../schema/index.js";
import {fieldKey, Row, RowSet} from "../shape/index.js";
import {BucketReads} from "../query/bucket/reads.js";
import {loadRowSets} from "../query/bucket/children.js";
import {childRows, Converter, insertMany} from "./row-writer.js";
import {valueAt} from "./values.js";

type Properties = NonNullable<Bucket["properties"]>;

const startsWith = (path: string[], prefix: string[]) =>
  prefix.every((segment, index) => path[index] == segment);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value == "object" && value !== null && !Array.isArray(value);

export function touchedPaths(
  properties: Properties,
  patch: Record<string, unknown>,
  prefix: string[] = []
): string[][] {
  return Object.entries(patch).flatMap(([name, change]) => {
    const property = properties[name];
    if (!property) {
      return [];
    }
    const path = [...prefix, name];
    return property.type == "object" && property.properties && isPlainObject(change)
      ? touchedPaths(property.properties as Properties, change, path)
      : [path];
  });
}

export async function lockRowSet(
  session: Session,
  metadata: BucketMetadata,
  key: unknown
): Promise<RowSet | undefined> {
  const {column} = metadata.primaryKey;
  const {rows} = await session.raw<Row>(
    `SELECT * FROM ${quote(metadata.main.name)} WHERE ${quote(column)} = $1 FOR UPDATE`,
    [key]
  );
  if (!rows.length) {
    return undefined;
  }
  const [rowSet] = await loadRowSets(new BucketReads(session), metadata, rows, () => false);
  return rowSet;
}

export function replaceRows(
  session: Session,
  bucket: Bucket,
  metadata: BucketMetadata,
  document: object,
  previous: RowSet
): Promise<RowSet> {
  return rewrite(session, bucket, metadata, document, previous, () => true);
}

export function patchRows(
  session: Session,
  bucket: Bucket,
  metadata: BucketMetadata,
  document: object,
  patch: Record<string, unknown>,
  previous: RowSet
): Promise<RowSet> {
  const touched = touchedPaths((bucket.properties ?? {}) as Properties, patch).filter(
    path => path.join("\0") != metadata.primaryKey.field
  );
  return rewrite(session, bucket, metadata, document, previous, path =>
    touched.some(prefix => startsWith(path, prefix))
  );
}

async function rewrite(
  session: Session,
  bucket: Bucket,
  metadata: BucketMetadata,
  document: object,
  previous: RowSet,
  isChanged: (path: string[]) => boolean
): Promise<RowSet> {
  const converter = new Converter(bucket);
  const {column: keyColumn} = metadata.primaryKey;
  const key = previous.main[keyColumn];

  const columns = metadata.main.columns.filter(
    column => column.name != keyColumn && isChanged(column.path)
  );
  const main = columns.length
    ? await updateMainRow(session, metadata, key, columns, document, converter)
    : previous.main;

  const children: Record<string, Row[]> = {...previous.children};
  for (const table of metadata.children.filter(table => isChanged(table.path))) {
    const name = fieldKey(table.path);
    if (previous.children?.[name]?.length) {
      await session.raw(
        `DELETE FROM ${quote(table.name)} WHERE ${quote(SYSTEM_COLUMNS.parent)} = $1`,
        [key]
      );
    }
    children[name] = await insertMany(session, table, childRows(table, document, key, converter));
  }
  return {main, children};
}

async function updateMainRow(
  session: Session,
  metadata: BucketMetadata,
  key: unknown,
  columns: ColumnMetadata[],
  document: object,
  converter: Converter
): Promise<Row> {
  const assignments = columns.map((column, index) => `${quote(column.name)} = $${index + 2}`);
  const {rows} = await session.raw<Row>(
    `UPDATE ${quote(metadata.main.name)} SET ${assignments.join(", ")} WHERE ${quote(metadata.primaryKey.column)} = $1 RETURNING *`,
    [key, ...columns.map(column => converter.value(column, valueAt(document, column.path)))]
  );
  return rows[0];
}

export async function deleteRow(
  session: Session,
  metadata: BucketMetadata,
  previous: RowSet
): Promise<void> {
  const {column} = metadata.primaryKey;
  await session.raw(`DELETE FROM ${quote(metadata.main.name)} WHERE ${quote(column)} = $1`, [
    previous.main[column]
  ]);
}
