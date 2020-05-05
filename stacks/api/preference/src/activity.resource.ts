import {Activity, PreActivity} from "@spica-server/activity/services";

export function createPreferenceActivity(preActivity: PreActivity, req: any, res: any): Activity[] {
  let activities: Activity[] = [];

  activities.push({...preActivity, resource: ["preference", req.params.scope]});

  return activities;
}
