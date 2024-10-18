import {ModuleActivity, PreActivity} from "@spica-server/activity/services";

export function createPreferenceActivity(
  preActivity: PreActivity,
  req: any,
  res: any
): ModuleActivity[] {
  let activities: ModuleActivity[] = [];

  activities.push({...preActivity, resource: ["preference", req.params.scope]});

  return activities;
}
