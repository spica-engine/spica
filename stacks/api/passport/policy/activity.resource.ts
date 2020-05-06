import {Action, PreActivity, Activity} from "@spica-server/activity/services";

export function createPolicyActivity(preActivity: PreActivity, req: any, res: any): Activity[] {
  let activities: Activity[] = [];

  switch (preActivity.action) {
    case Action.POST:
      activities.push({...preActivity, resource: ["passport", "policy", res._id.toString()]});
      break;
    case Action.PUT:
      activities.push({...preActivity, resource: ["passport", "policy", req.params.id]});
      break;
    case Action.DELETE:
      activities.push({...preActivity, resource: ["passport", "policy", req.params.id]});
      break;
  }

  return activities;
}
