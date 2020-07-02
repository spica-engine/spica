import {Statement, LastState} from "./interface";
import {ObjectId} from "@spica-server/database";

export function getStatementResult(
  req,
  statements: Array<Statement>,
  action: string,
  resource: string
): boolean {
  let filteredStatements = statements
    //filter by service
    .filter(st => action.substring(0, action.lastIndexOf(":")) == st.service)
    //filter by action
    .filter(
      st =>
        wrapArray(st.action).includes(st.service + ":*") || wrapArray(st.action).includes(action)
    )
    //map the resource ids
    .map(st => {
      st.resource = wrapArray(st.resource).map(res => res.replace(st.service + "/", ""));
      return st;
    });

  //we dont need to check resource for create and policy actions
  if ((action.includes("create") || action.includes("policy")) && filteredStatements.length > 0) {
    return createLastDecision(statements);
  }

  let state: LastState = createLastState(filteredStatements);

  //user doesnt have any allowed resource to perform this action
  if (!state.alloweds.length) {
    return false;
  } else {
    //pass the state to controller to create aggregation
    if (action.includes("index")) {
      req.headers["resource-state"] = state;
      return true;
    } else {
      //rest of actions
      let res = resource.substring(resource.lastIndexOf("/") + 1);
      return (
        (state.alloweds.includes("*") && !state.denieds.includes(res)) ||
        state.alloweds.includes(res)
      );
    }
  }
}

export function wrapArray(val: string | string[]) {
  return Array.isArray(val) ? val : Array(val);
}
export type StatementResult = true | false | undefined;

export function createLastDecision(statements: Statement[]): boolean {
  //get the latest effect
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

export function policyAggregation(state: LastState) {
  let aggregation = [];

  if (state.alloweds.length && !state.alloweds.includes("*")) {
    aggregation.push({
      $match: {
        _id: {
          $in: state.alloweds.filter(st => ObjectId.isValid(st)).map(st => new ObjectId(st))
        }
      }
    });
  }

  if (state.denieds.length && !state.denieds.includes("*")) {
    aggregation.length
      ? (aggregation[0]["$match"]["_id"]["$nin"] = state.denieds
          .filter(st => ObjectId.isValid(st))
          .map(st => new ObjectId(st)))
      : aggregation.push({
          $match: {
            _id: {
              $nin: state.denieds.filter(st => ObjectId.isValid(st)).map(st => new ObjectId(st))
            }
          }
        });
  }

  return aggregation;
}
