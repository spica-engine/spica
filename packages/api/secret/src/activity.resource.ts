import {Action, PreActivity, ModuleActivity} from "@spica-server/interface-activity";
import {idOf} from "@spica-server/data";

export function createSecretActivity(
  preActivity: PreActivity,
  req: any,
  res: any
): ModuleActivity[] {
  let activities: ModuleActivity[] = [];

  switch (preActivity.action) {
    case Action.POST:
      activities.push({...preActivity, resource: ["secret", idOf(res).toString()]});
      break;
    case Action.PUT:
      activities.push({...preActivity, resource: ["secret", req.params.id]});
      break;
    case Action.DELETE:
      activities.push({...preActivity, resource: ["secret", req.params.id]});
      break;
  }

  return activities;
}
