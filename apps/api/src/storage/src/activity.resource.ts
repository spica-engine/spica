import {Action, ModuleActivity, PreActivity} from "@spica-server/activity/services";

export function createStorageActivity(
  preActivity: PreActivity,
  req: any,
  res: any
): ModuleActivity[] {
  let activities: ModuleActivity[] = [];

  switch (preActivity.action) {
    case Action.POST:
      res.forEach(item => {
        activities.push({...preActivity, resource: ["storage", item._id.toString()]});
      });
      break;
    case Action.PUT:
      activities.push({...preActivity, resource: ["storage", req.params.id]});
      break;
    case Action.DELETE:
      activities.push({...preActivity, resource: ["storage", req.params.id]});
      break;
  }
  return activities;
}
