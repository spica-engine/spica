import {Bucket} from "@spica-server/interface-bucket";
import {PrimaryKeyMetadata} from "../primary-key.js";

export type ColumnType =
  | "uuid"
  | "text"
  | "integer"
  | "bigint"
  | "double precision"
  | "boolean"
  | "timestamptz"
  | "jsonb"
  | "point";

export interface ColumnMetadata {
  table: string;
  name: string;
  path: string[];
  type: ColumnType;
  notNull: boolean;
  enum?: unknown[];
  checkName?: string;
}

export interface IndexMetadata {
  table: string;
  name: string;
  method: "btree" | "gist";
  unique: boolean;
  columns: {name: string; order: "asc" | "desc"}[];
}

export interface ForeignKeyMetadata {
  name: string;
  column: string;
  table: string;
  referencedColumn: string;
  onDelete: "CASCADE" | "SET NULL" | "RESTRICT";
}

export interface TableMetadata {
  name: string;
  path: string[];
  columns: ColumnMetadata[];
  indexes: IndexMetadata[];
  keyColumns: string[];
  foreignKeys: ForeignKeyMetadata[];
}

export interface RelationTarget {
  table: string;
  primaryKey: PrimaryKeyMetadata;
}

export type RelationTargets = (bucketId: string) => RelationTarget | undefined;

export type IndexDefinition = NonNullable<Bucket["indexes"]>[number];

export interface BucketMetadata {
  bucketId: string;
  primaryKey: PrimaryKeyMetadata;
  main: TableMetadata;
  children: TableMetadata[];
  tables: TableMetadata[];
  columnOf(path: string[]): ColumnMetadata | undefined;
  indexOf(index: IndexDefinition): IndexMetadata;
}
