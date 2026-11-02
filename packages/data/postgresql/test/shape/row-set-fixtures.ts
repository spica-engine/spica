/*
 * TEMPORARY. Stand-ins for the parts that do not exist on PostgreSQL yet:
 * - insertDocument turns a document into rows. Part 9 (writes) replaces it with BUCKET_WRITE.
 * - fetchRowSet reads a row set. Part 8 (queries) replaces it with BUCKET_QUERY, which hands the
 *   row set to RESULT_SHAPER itself.
 * Delete this file when both are merged. contract/bucket-store.ts and shape/row-layout.spec.ts
 * are the only users.
 */
import {
  BucketDescription,
  columnName,
  fieldKey,
  RowSet,
  SYSTEM_COLUMNS,
  TableMetadata
} from "@spica-server/data-postgresql";
import pg from "pg";

type Describe = (bucketId: string) => BucketDescription;
type Row = Record<string, unknown>;
type Property = Record<string, any>;

const quote = (name: string) => `"${name}"`;

interface Write {
  table: string;
  row: Row;
}

function toColumnValue(property: Property, value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }
  if (property.type == "location") {
    const [x, y] = (value as {coordinates: number[]}).coordinates;
    return `(${x},${y})`;
  }
  if (property.type == "json" || property.type == "array" || property.type == "object") {
    return JSON.stringify(value);
  }
  return value;
}

class Decomposer {
  readonly writes: Write[] = [];

  constructor(
    private readonly description: BucketDescription,
    private readonly key: unknown
  ) {}

  run(document: Row) {
    const main: Write = {table: this.description.metadata.main.name, row: {}};
    this.writes.push(main);
    this.properties(main, this.description.metadata.main, [], this.topLevel(), document);
    return this.writes;
  }

  private topLevel() {
    return this.description.definition.properties as Record<string, Property>;
  }

  private properties(
    write: Write,
    table: TableMetadata,
    path: string[],
    properties: Record<string, Property>,
    source: Row
  ) {
    for (const [name, property] of Object.entries(properties)) {
      this.property(write, table, [...path, name], property, source?.[name]);
    }
  }

  private childTable(path: string[]) {
    return this.description.metadata.tables.find(table => fieldKey(table.path) == fieldKey(path));
  }

  private property(
    write: Write,
    table: TableMetadata,
    path: string[],
    property: Property,
    value: any
  ) {
    const column = columnName(path.slice(table.path.length));

    if (property.type == "object" && property.properties) {
      this.properties(write, table, path, property.properties, value);
    } else if (property.options?.translate) {
      const child = this.childTable(path);
      for (const [locale, translated] of Object.entries(value ?? {})) {
        this.writes.push({
          table: child.name,
          row: {
            [SYSTEM_COLUMNS.parent]: this.key,
            [SYSTEM_COLUMNS.locale]: locale,
            [SYSTEM_COLUMNS.value]: toColumnValue(property, translated)
          }
        });
      }
    } else if (property.type == "relation" && property.relationType == "onetomany") {
      const child = this.childTable(path);
      (value ?? []).forEach((target: unknown, position: number) =>
        this.writes.push({
          table: child.name,
          row: {
            [SYSTEM_COLUMNS.parent]: this.key,
            [SYSTEM_COLUMNS.position]: position,
            [SYSTEM_COLUMNS.target]: target
          }
        })
      );
    } else if ((property.type == "array" || property.type == "multiselect") && property.items) {
      const child = this.childTable(path);
      (value ?? []).forEach((item: any, position: number) => {
        const row: Write = {
          table: child.name,
          row: {[SYSTEM_COLUMNS.parent]: this.key, [SYSTEM_COLUMNS.position]: position}
        };
        this.writes.push(row);
        if (property.items.type == "object" && property.items.properties) {
          this.properties(row, child, path, property.items.properties, item);
        } else {
          row.row[SYSTEM_COLUMNS.value] = toColumnValue(property.items, item);
        }
      });
    } else {
      write.row[column] = toColumnValue(property, value);
    }
  }
}

export async function insertDocument(pool: pg.Pool, description: BucketDescription, document: Row) {
  const key = document[description.metadata.primaryKey.field];
  for (const {table, row} of new Decomposer(description, key).run(document)) {
    const columns = Object.keys(row);
    await pool.query(
      `INSERT INTO ${quote(table)} (${columns.map(quote).join(", ")}) VALUES (${columns
        .map((_, index) => `$${index + 1}`)
        .join(", ")})`,
      columns.map(column => row[column])
    );
  }
}

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
