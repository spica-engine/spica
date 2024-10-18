import {
  Action,
  PreActivity,
  ModuleActivity,
  createActivity,
  ActivityService
} from "@spica-server/activity/services";
import {deepCopy} from "@spica-server/core/patch";

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

export async function insertActivity(
  req: any,
  method: Action,
  bucketId: string,
  documentId: string,
  service: ActivityService
) {
  const request: any = {
    params: {}
  };

  request.params.bucketId = bucketId;
  request.params.documentId = documentId;
  request.method = Action[method];

  if (req.user) {
    request.user = deepCopy(req.user);
  }

  if (req.body) {
    request.body = deepCopy(req.body);
  }

  const response = {
    _id: documentId
  };

  const activities = createActivity(request, response, createBucketDataActivity);

  if (activities.length) {
    await service.insert(activities);
  }
}
