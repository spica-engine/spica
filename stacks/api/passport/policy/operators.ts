import {Statement} from "./interface";

export function getStatementResult(
  req,
  statements: Array<Statement>,
  action: string,
  resource: string
): boolean {
  let filteredStatements = statements
    //filter by service
    .filter(st => st["service"] + "/" == resource)
    //filter by action
    .filter(
      st =>
        wrapArray(st.action).includes(`${st["service"]}:*`) || wrapArray(st.action).includes(action)
    )
    //map the resources
    .map(st => {
      st.resource = wrapArray(st.resource).map(res => res.replace(resource, ""));
      return st;
    });

  if (!filteredStatements.length) {
    return false;
  }

  let decidedState = decideState(
    filteredStatements.map(st => {
      return {effect: st.effect, resource: wrapArray(st.resource)};
    })
  );

  //user doesnt have any allowed resource for perform this action
  if (!decidedState.alloweds.length) {
    return false;
  } else {
    //put it to the request header and return true, controller will filter the resources
    req.headers["resource-state"] = decidedState;
    return true;
  }
}

function wrapArray(val: string | string[]) {
  return Array.isArray(val) ? val : Array(val);
}
export type StatementResult = true | false | undefined;

function decideState(
  statements: {effect: "allow" | "deny"; resource: string[]}[]
): {alloweds: string[]; denieds: string[]} {
  return statements.reduce(
    (acc, curr) => {
      let state = acc;

      if (curr.resource == []) {
        return state;
      }

      if (curr.resource.includes("*")) {
        if (curr.effect == "allow") {
          //clear denieds and add the * to alloweds
          state.alloweds = ["*"];
          state.denieds = [];
        } else {
          //clear alloweds and add the * to denieds
          state.denieds = ["*"];
          state.alloweds = [];
        }
      } else {
        curr.resource.forEach(res => {
          if (curr.effect == "allow") {
            //delete it from denieds and add it to the alloweds
            state.denieds = state.denieds.filter(rs => rs != res);
            //don't add if it has '*'
            if (!state.alloweds.includes("*")) {
              state.alloweds.push(res);
            }
          } else {
            //delete it from alloweds and add it to the denieds
            state.alloweds = state.alloweds.filter(rs => rs != res);
            //don't add if it has '*'
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
