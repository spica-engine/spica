import * as matcher from "matcher";

export interface LastState {
  alloweds: string[];
  denieds: string[];
}

export interface Statement {
  effect: "allow" | "deny";
  action: string | string[];
  resource: string | string[];
  service: string;
}

export type StatementResult = true | false | undefined;

export function getStatementResult(
  statements: Array<Statement>,
  action: string,
  resource: string
): StatementResult {
  const applicableStatements = statements.filter(
    statement =>
      matcher([action], wrapArray(statement.action)).length > 0 &&
      matcher([resource], wrapArray(statement.resource)).length > 0
  );
  console.log(applicableStatements);
  if (applicableStatements.length < 1) {
    return undefined;
  }
  const statementResult = applicableStatements.map(s => s.effect == "allow");
  return statementResult.every(sr => sr) ? true : false;
}

export function wrapArray(val: string | string[]) {
  return Array.isArray(val) ? val : Array(val);
}

export function filterAndMapStatements(action: string, statements: Statement[]) {
  return statements
    .filter(st => action.substring(0, action.lastIndexOf(":")) == st.service)
    .filter(
      st =>
        wrapArray(st.action).includes(st.service + ":*") || wrapArray(st.action).includes(action)
    )
    .map(st => {
      st.resource = wrapArray(st.resource).map(res => res.replace(st.service + "/", ""));
      return st;
    });
}

export function createLastDecision(statements: Statement[]): boolean {
  return statements[statements.length - 1].effect == "allow";
}

export function createLastState(statements: Statement[]): LastState {
  return statements.reduce(
    (acc, curr) => {
      let state = acc;

      if (wrapArray(curr.resource).includes("*")) {
        if (curr.effect == "allow") {
          state.alloweds = ["*"];
          state.denieds = [];
        } else {
          state.denieds = ["*"];
          state.alloweds = [];
        }
      } else {
        wrapArray(curr.resource).forEach(res => {
          if (curr.effect == "allow") {
            state.denieds = state.denieds.filter(rs => rs != res);
            if (!state.alloweds.includes("*")) {
              state.alloweds.push(res);
            }
          } else {
            state.alloweds = state.alloweds.filter(rs => rs != res);
            if (!state.denieds.includes("*")) {
              state.denieds.push(res);
            }
          }
        });
      }
      return state;
    },
    {alloweds: [], denieds: []}
  );
}