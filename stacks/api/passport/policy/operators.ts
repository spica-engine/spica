import * as matcher from "matcher";
import {Statement} from "./interface";

export function getStatementResult(
  statements: Array<Statement>,
  action: string,
  resource: string
): StatementResult {
  const applicableStatements = statements.filter(
    si =>
      matcher(wrapArray(action), wrapArray(si.action)).length > 0 &&
      matcher(wrapArray(resource), wrapArray(si.resource)).length > 0
  );
  if (applicableStatements.length < 1) {
    return undefined;
  }
  const statementResult = applicableStatements.map(s => s.effect == "allow");
  return statementResult.every(sr => sr) ? true : false;
}

function wrapArray(val: string | string[]) {
  return Array.isArray(val) ? val : Array(val);
}
export type StatementResult = true | false | undefined;
