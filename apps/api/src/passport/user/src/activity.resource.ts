import {Action, PreActivity, ModuleActivity} from "@spica-server/interface/activity";

export function createUserActivity(preActivity: PreActivity, req: any, res: any): ModuleActivity[] {
  let activities: ModuleActivity[] = [];

  switch (preActivity.action) {
    case Action.POST:
      activities.push({
        ...preActivity,
        resource: ["passport", "user", res._id.toString()]
      });
      break;
    case Action.PUT:
      activities.push({
        ...preActivity,
        resource: ["passport", "user", req.params.id]
      });
      break;
    case Action.DELETE:
      activities.push({
        ...preActivity,
        resource: ["passport", "user", req.params.id]
      });
      break;
  }

  return activities;
}
