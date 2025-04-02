import {Policy, ActionMap} from "@spica-server/interface/passport/policy";

export function getDuplicatedActionMaps(policy: Policy) {
  const actionMaps: ActionMap[] = [];

  const actions = policy.statement.map(statement => statement.action);

  for (const [index, action] of actions.entries()) {
    const actionMapIndex = actionMaps.findIndex(actionMap => actionMap.action == action);

    // action has already exist
    if (actionMapIndex != -1) {
      actionMaps[actionMapIndex].indexes.push(index);
    } else {
      // first occurrence
      const actionMap = {action: action, indexes: [index]};
      actionMaps.push(actionMap);
    }
  }

  // return only duplicateds
  return actionMaps.filter(actionMap => actionMap.indexes.length >= 2);
}

export function createDuplicatedActionsErrorMessage(actionMaps: ActionMap[]) {
  const lines: string[] = [];

  for (const actionMap of actionMaps) {
    const statements = actionMap.indexes.map(index => `statement[${index}]`).join(", ");

    const line = `${statements} includes the same action: '${actionMap.action}'.`;

    lines.push(line);
  }

  return lines.join("\n");
}
