import {Action, Activity, PreActivity} from "@spica-server/activity/services";

export function createBucketActivity(preActivity: PreActivity, req: any, res: any): Activity[] {
  let activities: Activity[] = [];

  switch (preActivity.action) {
    case Action.POST:
      activities.push({...preActivity, resource: ["bucket", res._id.toString()]});
      break;
    case Action.PUT:
      activities.push({...preActivity, resource: ["bucket", req.params.id]});
      break;
    case Action.DELETE:
      activities.push({...preActivity, resource: ["bucket", req.params.id]});
      break;
  }

  return activities;
}

export function createBucketDataActivity(
  preActivity: {identifier: string; action: Action},
  req: any,
  res: any
): Activity[] {
  let activities: Activity[] = [];

  switch (preActivity.action) {
    case Action.POST:
      activities.push({
        ...preActivity,
        resource: ["bucket", req.params.bucketId.toString(), "data", res._id.toString()]
      });
      break;
    case Action.PUT:
      activities.push({
        ...preActivity,
        resource: ["bucket", req.params.bucketId.toString(), "data", req.params.documentId]
      });
      break;
    case Action.DELETE:
      if (req.params.documentId) {
        activities.push({
          ...preActivity,
          resource: ["bucket", req.params.bucketId.toString(), "data", req.params.documentId]
        });
      } else {
        req.body.forEach(id =>
          activities.push({
            ...preActivity,
            resource: ["bucket", req.params.bucketId.toString(), "data", id]
          })
        );
      }
      break;
  }

  return activities;
}
