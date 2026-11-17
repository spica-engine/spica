import {constraintName, NamedIdentifier} from "../naming.js";
import {TableMetadata} from "./types.js";

const SCHEMA = "the schema";

const tableIdentifier = (table: TableMetadata): NamedIdentifier => ({
  scope: SCHEMA,
  name: table.name,
  logical: `table for ${table.path.join(".") || "the bucket"}`
});

const columnIdentifiers = (table: TableMetadata): NamedIdentifier[] =>
  table.columns.map(column => ({
    scope: `table "${table.name}"`,
    name: column.name,
    logical: column.path.join("__")
  }));

const indexIdentifiers = (table: TableMetadata): NamedIdentifier[] =>
  table.indexes.map(index => ({scope: SCHEMA, name: index.name, logical: index.name}));

const checkIdentifiers = (table: TableMetadata): NamedIdentifier[] =>
  table.columns
    .filter(column => column.checkName)
    .map(column => ({scope: SCHEMA, name: column.checkName, logical: `${column.name} check`}));

const primaryKeyIdentifier = (table: TableMetadata): NamedIdentifier => ({
  scope: SCHEMA,
  name: constraintName(table.name, table.keyColumns, "pk"),
  logical: `primary key of ${table.name}`
});

const foreignKeyIdentifiers = (table: TableMetadata): NamedIdentifier[] =>
  table.foreignKeys.map(key => ({
    scope: SCHEMA,
    name: key.name,
    logical: `foreign key of ${table.name}`
  }));

export const identifiersOf = (tables: TableMetadata[]): NamedIdentifier[] =>
  tables.flatMap(table => [
    tableIdentifier(table),
    ...columnIdentifiers(table),
    ...indexIdentifiers(table),
    ...checkIdentifiers(table),
    primaryKeyIdentifier(table),
    ...foreignKeyIdentifiers(table)
  ]);
