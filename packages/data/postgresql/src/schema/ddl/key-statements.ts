import {quote} from "@spica-server/data-postgresql-orm";
import {BucketMetadata, TableMetadata} from "../metadata/index.js";
import {constraintName} from "../naming.js";
import {PrimaryKeyMetadata} from "../primary-key.js";
import {conversionSql} from "./conversion.js";
import {addGenerationSql, backfillSql, dropGenerationSql} from "./generation.js";
import {KeyChange, MAP_FUNCTION, MAP_TABLE, movesKeyValues} from "./key-change.js";
import {addPrimaryKeySql, alterColumn, dropConstraintSql} from "./sql.js";

export interface KeyStatements {
  before: string[];
  afterAdds: string[];
  afterDrops: string[];
  final: string[];
  cleanup: string[];
}

interface KeyScope {
  was: TableMetadata;
  is: TableMetadata;
  old: PrimaryKeyMetadata;
  target: PrimaryKeyMetadata;
  fieldChanged: boolean;
  keyMoves: boolean;
  newColumnExisted: boolean;
}

const retype = (table: string, column: string, type: string, using: string) =>
  alterColumn(table, column, `TYPE ${type} USING ${using}`);

function dropOldKey({was, old, keyMoves}: KeyScope) {
  const dropConstraint = keyMoves
    ? [dropConstraintSql(was.name, constraintName(was.name, [old.column], "pk"), true)]
    : [];
  return [...dropConstraint, ...dropGenerationSql(was.name, old)];
}

function convertNewKeyColumn({was, target, newColumnExisted}: KeyScope) {
  if (!newColumnExisted) {
    return [];
  }
  const existing = was.columns.find(column => column.name == target.column);
  return [
    retype(
      was.name,
      target.column,
      target.type,
      conversionSql(target.column, existing.type, target.type)
    ),
    ...(target.generated ? backfillSql(was.name, target) : [])
  ];
}

function buildKeyMap({is, old, target}: KeyScope) {
  const main = quote(is.name);
  return [
    `CREATE TEMP TABLE ${MAP_TABLE} ON COMMIT DROP AS SELECT ${quote(old.column)}::${old.type} AS old_key, ${quote(target.column)}::${target.type} AS new_key FROM ${main}`,
    `CREATE FUNCTION pg_temp.${MAP_FUNCTION}(old_key ${old.type}) RETURNS ${target.type} LANGUAGE sql STABLE AS 'SELECT new_key FROM pg_temp.${MAP_TABLE} WHERE old_key = $1'`
  ];
}

function demoteOldKeyColumn({was, is, old}: KeyScope) {
  const after = is.columns.find(column => column.name == old.column);
  if (!after) {
    return [];
  }
  const before = was.columns.find(column => column.name == old.column);
  return [
    ...(before.type != after.type
      ? [
          retype(
            is.name,
            old.column,
            after.type,
            conversionSql(old.column, before.type, after.type)
          )
        ]
      : []),
    ...(!after.notNull ? [alterColumn(is.name, old.column, "DROP NOT NULL")] : [])
  ];
}

function convertKeyColumnType({is, old, target}: KeyScope) {
  return [
    retype(is.name, old.column, target.type, conversionSql(old.column, old.type, target.type))
  ];
}

function promoteNewKey({is, target, keyMoves}: KeyScope, addedWithGeneration: boolean) {
  return [
    ...(addedWithGeneration ? [] : [alterColumn(is.name, target.column, "SET NOT NULL")]),
    ...(keyMoves ? [addPrimaryKeySql(is.name, target.column)] : []),
    ...(addedWithGeneration ? [] : addGenerationSql(is.name, target))
  ];
}

export function keyStatements(
  previous: BucketMetadata,
  next: BucketMetadata,
  key: KeyChange
): KeyStatements {
  const scope: KeyScope = {
    was: previous.main,
    is: next.main,
    old: key.previous,
    target: key.next,
    fieldChanged: key.previous.field != key.next.field,
    keyMoves: movesKeyValues(key),
    newColumnExisted: previous.main.columns.some(column => column.name == key.next.column)
  };
  const typeChanged = scope.old.type != scope.target.type;
  const addedWithGeneration = scope.fieldChanged && !scope.newColumnExisted;

  return {
    before: dropOldKey(scope),
    afterAdds: scope.fieldChanged ? [...convertNewKeyColumn(scope), ...buildKeyMap(scope)] : [],
    afterDrops: scope.fieldChanged
      ? demoteOldKeyColumn(scope)
      : typeChanged
        ? convertKeyColumnType(scope)
        : [],
    final: promoteNewKey(scope, addedWithGeneration),
    cleanup: scope.fieldChanged
      ? [`DROP FUNCTION IF EXISTS pg_temp.${MAP_FUNCTION}(${scope.old.type})`]
      : []
  };
}
