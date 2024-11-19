import {Action, ModuleActivity, PreActivity} from "@spica-server/activity/services";

export function createApikeyActivity(
  preActivity: PreActivity,
  req: any,
  res: any
): ModuleActivity[] {
  let activities: ModuleActivity[] = [];

  switch (preActivity.action) {
    case Action.POST:
      activities.push({
        ...preActivity,
        resource: ["passport", "apikey", res._id.toString()]
      });
      break;
    case Action.PUT:
      activities.push({
        ...preActivity,
        resource: ["passport", "apikey", req.params.id]
      });
      break;
    case Action.DELETE:
      activities.push({
        ...preActivity,
        resource: ["passport", "apikey", req.params.id]
      });
      break;
  }

  return activities;
}
