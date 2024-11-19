import {Action, PreActivity, ModuleActivity} from "@spica/api/src/activity/services";

export function createFunctionActivity(
  preActivity: PreActivity,
  req: any,
  res: any
): ModuleActivity[] {
  let activities: ModuleActivity[] = [];

  switch (preActivity.action) {
    case Action.POST:
      activities.push({...preActivity, resource: ["function", res._id.toString()]});
      break;
    case Action.PUT:
      activities.push({...preActivity, resource: ["function", req.params.id]});
      break;
    case Action.DELETE:
      activities.push({...preActivity, resource: ["function", req.params.id]});
      break;
  }

  return activities;
}
