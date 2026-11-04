import {TableMetadata} from "../metadata/index.js";
import {foreignKeyNamed, isRetyped, sameForeignKey} from "./compare.js";
import {PlanBuilder} from "./plan.js";
import {TablePair} from "./scope.js";
import {addForeignKeySql, createIndexSql, dropConstraintSql, dropIndexSql} from "./sql.js";

export function planForeignKeys(plan: PlanBuilder, {before, after}: TablePair) {
  for (const key of before.foreignKeys) {
    const still = foreignKeyNamed(after, key.name);
    if (!still || !sameForeignKey(still, key) || isRetyped(before, after, key.column)) {
      plan.add("dropForeignKeys", dropConstraintSql(after.name, key.name, true));
    }
  }
  for (const key of after.foreignKeys) {
    const was = foreignKeyNamed(before, key.name);
    if (!was || !sameForeignKey(was, key) || isRetyped(before, after, key.column)) {
      plan.add("addForeignKeys", addForeignKeySql(after.name, key));
    }
  }
}

export function planIndexes(plan: PlanBuilder, {before, after}: TablePair) {
  const beforeNames = new Set(before.indexes.map(index => index.name));
  const afterNames = new Set(after.indexes.map(index => index.name));
  plan.add(
    "dropIndexes",
    ...before.indexes
      .filter(index => !afterNames.has(index.name))
      .map(index => dropIndexSql(index.name))
  );
  plan.add(
    "createIndexes",
    ...after.indexes.filter(index => !beforeNames.has(index.name)).map(createIndexSql)
  );
}

export function planCreatedTable(plan: PlanBuilder, table: TableMetadata) {
  plan.add("addForeignKeys", ...table.foreignKeys.map(key => addForeignKeySql(table.name, key)));
  plan.add("createIndexes", ...table.indexes.map(createIndexSql));
}
