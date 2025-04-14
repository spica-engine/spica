import {Action, PreActivity, ModuleActivity} from "@spica-server/activity/services";

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

export function createFunctionIndexActivity(
  preActivity: PreActivity,
  req: any,
  res: any
): ModuleActivity[] {
  let activities: ModuleActivity[] = [];

  switch (preActivity.action) {
    case Action.POST:
      activities.push({...preActivity, resource: ["function", req.params.id, "index"]});
      break;
  }

  return activities;
}

export function createFunctionDependencyActivity(
  preActivity: PreActivity,
  req: any,
  res: any
): ModuleActivity[] {
  let activities: ModuleActivity[] = [];

  switch (preActivity.action) {
    case Action.POST:
      activities.push({
        ...preActivity,
        resource: ["function", req.params.id, "dependency", req.body.name]
      });
      break;
    case Action.DELETE:
      activities.push({
        ...preActivity,
        resource: ["function", req.params.id, "dependency", req.params.name]
      });
      break;
  }

  return activities;
}

export function createFunctionEnvVarActivity(
  preActivity: PreActivity,
  req: any,
  res: any
): ModuleActivity[] {
  let activities: ModuleActivity[] = [];

  switch (preActivity.action) {
    case Action.PUT:
      activities.push({
        ...preActivity,
        resource: ["function", req.params.id, "env-var", req.params.envVarId]
      });
      break;
    case Action.DELETE:
      activities.push({
        ...preActivity,
        resource: ["function", req.params.id, "env-var", req.params.envVarId]
      });
      break;
  }

  return activities;
}
