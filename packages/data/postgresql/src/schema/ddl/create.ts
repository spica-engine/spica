import {BucketMetadata, TableMetadata} from "../metadata/index.js";
import {checkSql, createIndexSql, createTableSql} from "./sql.js";

export function createTableStatements(
  metadata: BucketMetadata,
  table: TableMetadata,
  withForeignKeys = true
) {
  return [
    createTableSql(metadata, table, withForeignKeys),
    ...table.columns.filter(column => column.enum).map(column => checkSql(table.name, column))
  ];
}

export function createStatements(metadata: BucketMetadata): string[] {
  return [
    ...metadata.tables.flatMap(table => createTableStatements(metadata, table)),
    ...metadata.tables.flatMap(table => table.indexes.map(createIndexSql))
  ];
}
