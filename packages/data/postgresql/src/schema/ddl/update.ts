import {BucketMetadata, TableMetadata} from "../metadata/index.js";
import {sameKeyColumns} from "./compare.js";
import {planColumns} from "./columns.js";
import {planCreatedTable, planForeignKeys, planIndexes} from "./constraints.js";
import {createTableStatements} from "./create.js";
import {KeyChange} from "./key-change.js";
import {keyStatements} from "./key-statements.js";
import {PlanBuilder, statementsOf, UpdatePlan} from "./plan.js";
import {UpdateScope} from "./scope.js";
import {dropTablesStatements} from "./sql.js";

function diffTables(previous: BucketMetadata, next: BucketMetadata) {
  const before = (table: TableMetadata) =>
    previous.tables.find(candidate => candidate.name == table.name);
  const isRecreated = (table: TableMetadata) =>
    table.name != next.main.name && !sameKeyColumns(before(table), table);

  const kept = next.tables.filter(table => before(table) && !isRecreated(table));
  const keptNames = new Set(kept.map(table => table.name));
  return {
    kept: kept.map(after => ({before: before(after), after})),
    created: next.tables.filter(table => !keptNames.has(table.name)),
    dropped: previous.tables.filter(table => !keptNames.has(table.name))
  };
}

function planKeyChange(plan: PlanBuilder, scope: UpdateScope) {
  const statements = keyStatements(scope.previous, scope.next, scope.ownKey);
  plan.add("dropOldKey", ...statements.before);
  plan.add("prepareNewKey", ...statements.afterAdds);
  plan.add("reshapeKey", ...statements.afterDrops);
  plan.add("promoteKey", ...statements.final);
  plan.add("cleanupKey", ...statements.cleanup);
}

export function planUpdate(
  previous: BucketMetadata,
  next: BucketMetadata,
  keyChange?: KeyChange
): UpdatePlan {
  const ownKey = keyChange?.table == previous.main.name ? keyChange : undefined;
  const scope: UpdateScope = {previous, next, keyChange, ownKey};
  const {kept, created, dropped} = diffTables(previous, next);
  const plan = new PlanBuilder();

  plan.add("dropTables", ...dropTablesStatements(dropped.map(table => table.name)));
  plan.add("createTables", ...created.flatMap(table => createTableStatements(next, table, false)));
  for (const pair of kept) {
    planColumns(plan, scope, pair);
    planForeignKeys(plan, pair);
    planIndexes(plan, pair);
  }
  created.forEach(table => planCreatedTable(plan, table));
  if (ownKey) {
    planKeyChange(plan, scope);
  }
  return plan.build();
}

export const updateStatements = (
  previous: BucketMetadata,
  next: BucketMetadata,
  keyChange?: KeyChange
) => statementsOf(planUpdate(previous, next, keyChange));
