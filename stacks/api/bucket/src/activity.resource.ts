import {Action, PreActivity, ModuleActivity} from "@spica-server/activity/services";

export function createBucketActivity(
  preActivity: PreActivity,
  req: any,
  res: any
): ModuleActivity[] {
  const bucketId = (preActivity.action == Action.POST ? res._id : req.params.id).toString();

  const resource = ["bucket", bucketId];

  return [{...preActivity, resource}];
}

export function createBucketDataActivity(
  preActivity: PreActivity,
  req: any,
  res: any
): ModuleActivity[] {
  const bucketId = req.params.bucketId.toString();

  const documentId = (preActivity.action == Action.POST
    ? res._id
    : req.params.documentId
  ).toString();

  const resource = ["bucket", bucketId, "data", documentId];

  return [{...preActivity, resource}];
}
