import {createChangeTriggerSql} from "../../change/sql.js";
import {BucketMetadata, TableMetadata} from "../metadata/index.js";
import {SYSTEM_COLUMNS} from "../naming.js";

export function changeTriggerSql(metadata: BucketMetadata, table: TableMetadata) {
  if (table.name == metadata.main.name) {
    return createChangeTriggerSql(table.name, {
      target: table.name,
      keyColumn: metadata.primaryKey.column
    });
  }
  return createChangeTriggerSql(table.name, {
    target: metadata.main.name,
    keyColumn: SYSTEM_COLUMNS.parent,
    field: table.path[0]
  });
}
