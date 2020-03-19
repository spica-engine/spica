import {Action, Activity} from "@spica-server/activity";

export function createBucketDataActivity(preActivity: Activity, req: any, res: any): Activity {
  const action = Object.values(Action)[Object.keys(Action).findIndex(val => val === req.method)];
  let activity: Activity = {
    ...preActivity,
    resource: ["BUCKET", req.params.bucketId.toString()],
    verb: action
  };
  if (action == Action.POST) {
    activity.resource.push(res._id ? res._id : undefined);
  } else {
    activity.resource.push(
      req.params ? (req.params.documentId ? req.params.documentId : undefined) : undefined
    );
  }
  return activity;
}

export function createBucketActivity(preActivity: Activity, req: any, res: any): Activity {
  const action = Object.values(Action)[Object.keys(Action).findIndex(val => val === req.method)];
  let activity: Activity = {
    ...preActivity,
    resource: ["BUCKET"],
    verb: action
  };
  console.log(req.params);
  if (action == Action.POST) {
    activity.resource.push(res._id ? res._id : undefined);
  } else {
    activity.resource.push(req.params ? (req.params.id ? req.params.id : undefined) : undefined);
  }
  return activity;
}
