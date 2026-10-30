import {ColumnMetadata, TableMetadata} from "../metadata/index.js";
import {columnNamed, sameEnum} from "./compare.js";
import {conversionSql} from "./conversion.js";
import {keyMapFunction, remapsKeyValues} from "./key-change.js";
import {PlanBuilder} from "./plan.js";
import {TablePair, UpdateScope} from "./scope.js";
import {addColumnSql, alterColumn, checkSql, dropColumnSql, dropConstraintSql} from "./sql.js";

function convertedValue(
  scope: UpdateScope,
  table: TableMetadata,
  was: ColumnMetadata,
  is: ColumnMetadata
) {
  const references = scope.keyChange
    ? table.foreignKeys.some(key => key.column == was.name && key.table == scope.keyChange.table)
    : false;
  return remapsKeyValues(scope.keyChange) && references
    ? keyMapFunction(was.name)
    : conversionSql(was.name, was.type, is.type);
}

function isKeyColumn(scope: UpdateScope, table: TableMetadata, column: ColumnMetadata) {
  return (
    Boolean(scope.ownKey) &&
    table.name == scope.next.main.name &&
    (column.name == scope.ownKey.previous.column || column.name == scope.ownKey.next.column)
  );
}

function planAddedColumn(
  plan: PlanBuilder,
  scope: UpdateScope,
  table: TableMetadata,
  is: ColumnMetadata
) {
  plan.add("addColumns", addColumnSql(scope.next, table, is));
  if (is.enum) {
    plan.add("addChecks", checkSql(table.name, is));
  }
}

function planChangedColumn(
  plan: PlanBuilder,
  scope: UpdateScope,
  {before, after}: TablePair,
  was: ColumnMetadata,
  is: ColumnMetadata
) {
  const typeChanged = was.type != is.type;
  const checkChanged = typeChanged || !sameEnum(was, is);
  if (checkChanged && was.checkName) {
    plan.add("dropChecks", dropConstraintSql(after.name, was.checkName));
  }
  if (checkChanged && is.enum) {
    plan.add("addChecks", checkSql(after.name, is));
  }
  if (isKeyColumn(scope, after, is)) {
    return;
  }
  if (typeChanged) {
    const using = convertedValue(scope, before, was, is);
    plan.add("alterTypes", alterColumn(after.name, is.name, `TYPE ${is.type} USING ${using}`));
  }
  if (was.notNull != is.notNull) {
    plan.add(
      "alterNullability",
      alterColumn(after.name, is.name, `${is.notNull ? "SET" : "DROP"} NOT NULL`)
    );
  }
}

export function planColumns(plan: PlanBuilder, scope: UpdateScope, pair: TablePair) {
  const {before, after} = pair;
  for (const was of before.columns) {
    if (!columnNamed(after, was.name)) {
      plan.add("dropColumns", dropColumnSql(after.name, was.name));
    }
  }
  for (const is of after.columns) {
    const was = columnNamed(before, is.name);
    if (was) {
      planChangedColumn(plan, scope, pair, was, is);
    } else {
      planAddedColumn(plan, scope, after, is);
    }
  }
}
