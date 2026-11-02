import {constraintName, SYSTEM_COLUMNS} from "../naming.js";
import {PrimaryKeyMetadata} from "../primary-key.js";
import {ColumnMetadata, ForeignKeyMetadata, RelationTarget, TableMetadata} from "./types.js";

export type TableKind = "position" | "locale";

export class TableBuilder {
  readonly columns: ColumnMetadata[] = [];
  readonly foreignKeys: ForeignKeyMetadata[] = [];

  constructor(
    readonly name: string,
    readonly path: string[],
    readonly keyedBy: TableKind = "position"
  ) {}

  add(column: Omit<ColumnMetadata, "table" | "checkName">) {
    this.columns.push({
      ...column,
      table: this.name,
      ...(column.enum ? {checkName: constraintName(this.name, [column.name], "ck")} : {})
    });
  }

  reference(column: string, target: RelationTarget, onDelete: ForeignKeyMetadata["onDelete"]) {
    this.foreignKeys.push({
      name: constraintName(this.name, [column], "fk"),
      column,
      table: target.table,
      referencedColumn: target.primaryKey.column,
      onDelete
    });
  }

  buildMain(primaryKey: PrimaryKeyMetadata): TableMetadata {
    return {
      name: this.name,
      path: this.path,
      columns: this.columns,
      indexes: [],
      keyColumns: [primaryKey.column],
      foreignKeys: this.foreignKeys
    };
  }

  buildChild(mainTable: string, primaryKey: PrimaryKeyMetadata): TableMetadata {
    const keyColumn = this.keyedBy == "locale" ? SYSTEM_COLUMNS.locale : SYSTEM_COLUMNS.position;
    return {
      name: this.name,
      path: this.path,
      columns: [...this.systemColumns(primaryKey), ...this.columns],
      indexes: [],
      keyColumns: [SYSTEM_COLUMNS.parent, keyColumn],
      foreignKeys: [this.parentKey(mainTable, primaryKey), ...this.foreignKeys]
    };
  }

  private systemColumns(primaryKey: PrimaryKeyMetadata): ColumnMetadata[] {
    const parent: ColumnMetadata = {
      table: this.name,
      name: SYSTEM_COLUMNS.parent,
      path: this.path,
      type: primaryKey.type,
      notNull: true
    };
    const position: ColumnMetadata = {
      table: this.name,
      name: SYSTEM_COLUMNS.position,
      path: this.path,
      type: "integer",
      notNull: true
    };
    return this.keyedBy == "position" ? [parent, position] : [parent];
  }

  private parentKey(mainTable: string, primaryKey: PrimaryKeyMetadata): ForeignKeyMetadata {
    return {
      name: constraintName(this.name, [SYSTEM_COLUMNS.parent], "fk"),
      column: SYSTEM_COLUMNS.parent,
      table: mainTable,
      referencedColumn: primaryKey.column,
      onDelete: "CASCADE"
    };
  }
}
