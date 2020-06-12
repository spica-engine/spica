import {Action, PreActivity, Activity} from "@spica-server/activity/services";

export function createIdentityActivity(preActivity: PreActivity, req: any, res: any): Activity[] {
  let activities: Activity[] = [];

  switch (preActivity.action) {
    case Action.POST:
      activities.push({...preActivity, resource: ["passport", "identity", res._id.toString()]});
      break;
    case Action.PUT:
      activities.push({...preActivity, resource: ["passport", "identity", req.params.id]});
      break;
    case Action.DELETE:
      activities.push({...preActivity, resource: ["passport", "identity", req.params.id]});
      break;
  }

  return activities;
}
