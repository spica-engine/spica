import {Action, PreActivity, ModuleActivity} from "@spica-server/activity/services";

export function createEnvVarActivity(
  preActivity: PreActivity,
  req: any,
  res: any
): ModuleActivity[] {
  let activities: ModuleActivity[] = [];

  switch (preActivity.action) {
    case Action.POST:
      activities.push({...preActivity, resource: ["env_var", res._id.toString()]});
      break;
    case Action.PUT:
      activities.push({...preActivity, resource: ["env_var", req.params.id]});
      break;
    case Action.DELETE:
      activities.push({...preActivity, resource: ["env_var", req.params.id]});
      break;
  }

  return activities;
}
