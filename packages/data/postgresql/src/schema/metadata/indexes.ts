import {Bucket} from "@spica-server/interface-bucket";
import {BucketSchemaError, constraintName} from "../naming.js";
import {ColumnMetadata, IndexDefinition, IndexMetadata, TableMetadata} from "./types.js";

type ColumnLookup = (path: string[]) => ColumnMetadata | undefined;

interface IndexedColumn {
  table: string;
  name: string;
  order: "asc" | "desc";
}

interface DescribedIndex {
  metadata?: IndexMetadata;
  problems: string[];
}

function indexedColumns(columnOf: ColumnLookup, index: IndexDefinition) {
  const label = JSON.stringify(index.definition);
  const columns: IndexedColumn[] = [];
  const problems: string[] = [];

  for (const [field, direction] of Object.entries(index.definition)) {
    const column = columnOf(field.split("."));
    if (!column) {
      problems.push(`Index ${label} refers to "${field}", which has no column.`);
    } else {
      columns.push({
        table: column.table,
        name: column.name,
        order: direction == -1 ? "desc" : "asc"
      });
    }
  }

  if (new Set(columns.map(column => column.table)).size > 1) {
    problems.push(`Index ${label} spans more than one table, which PostgreSQL cannot index.`);
  }
  return {columns, problems};
}

const indexName = (table: string, columns: IndexedColumn[], unique: boolean) =>
  constraintName(
    table,
    columns.map(column => (column.order == "desc" ? `${column.name}_desc` : column.name)),
    unique ? "uq" : "ix"
  );

export function describeIndex(columnOf: ColumnLookup, index: IndexDefinition): DescribedIndex {
  const {columns, problems} = indexedColumns(columnOf, index);
  if (problems.length) {
    return {problems};
  }

  const [{table}] = columns;
  const unique = Boolean(index.options?.unique);
  return {
    metadata: {
      table,
      name: indexName(table, columns, unique),
      method: Object.values(index.definition).includes("2dsphere") ? "gist" : "btree",
      unique,
      columns: columns.map(({name, order}) => ({name, order}))
    },
    problems
  };
}

export function attachIndexes(tables: TableMetadata[], bucket: Bucket, columnOf: ColumnLookup) {
  const problems: string[] = [];
  for (const index of bucket.indexes ?? []) {
    const described = describeIndex(columnOf, index);
    problems.push(...described.problems);
    if (described.metadata) {
      tables.find(table => table.name == described.metadata.table).indexes.push(described.metadata);
    }
  }
  if (problems.length) {
    throw new BucketSchemaError(problems);
  }
}

export function indexOf(columnOf: ColumnLookup, index: IndexDefinition): IndexMetadata {
  const {metadata, problems} = describeIndex(columnOf, index);
  if (!metadata) {
    throw new BucketSchemaError(problems);
  }
  return metadata;
}
