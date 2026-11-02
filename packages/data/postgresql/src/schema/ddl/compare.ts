import {ColumnMetadata, ForeignKeyMetadata, TableMetadata} from "../metadata/index.js";

export const sameEnum = (a: ColumnMetadata, b: ColumnMetadata) =>
  JSON.stringify(a.enum) == JSON.stringify(b.enum);

export const sameKeyColumns = (a: TableMetadata, b: TableMetadata) =>
  JSON.stringify(a.keyColumns) == JSON.stringify(b.keyColumns);

export const sameForeignKey = (a: ForeignKeyMetadata, b: ForeignKeyMetadata) =>
  a.table == b.table && a.referencedColumn == b.referencedColumn && a.onDelete == b.onDelete;

export const columnNamed = (table: TableMetadata, name: string) =>
  table.columns.find(column => column.name == name);

export const foreignKeyNamed = (table: TableMetadata, name: string) =>
  table.foreignKeys.find(key => key.name == name);

export const isRetyped = (before: TableMetadata, after: TableMetadata, column: string) => {
  const was = columnNamed(before, column);
  const is = columnNamed(after, column);
  return Boolean(was && is && was.type != is.type);
};
