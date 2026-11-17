import {createActivity, ActivityService} from "@spica-server/activity-services";
import {deepCopy} from "@spica-server/core-patch";
import {Action, PreActivity, ModuleActivity} from "@spica-server/interface-activity";
import {Id} from "@spica-server/interface-data";
import {idOf} from "@spica-server/data";

export function createBucketActivity(
  preActivity: PreActivity,
  req: any,
  res: any
): ModuleActivity[] {
  const bucketId = (preActivity.action == Action.POST ? idOf(res) : req.params.id).toString();

  const resource = ["bucket", bucketId];

  return [{...preActivity, resource}];
}

export function createBucketDataActivity(
  preActivity: PreActivity,
  req: any,
  res: any
): ModuleActivity[] {
  const bucketId = req.params.bucketId.toString();

  const documentId = (
    preActivity.action == Action.POST ? req.documentKey : req.params.documentId
  ).toString();

  const resource = ["bucket", bucketId, "data", documentId];

  return [{...preActivity, resource}];
}

export async function insertActivity(
  req: any,
  method: Action,
  bucketId: string,
  documentId: string | Id,
  service: ActivityService
) {
  const request: any = {
    params: {}
  };

  request.params.bucketId = bucketId;
  request.params.documentId = documentId;
  request.documentKey = documentId;
  request.method = Action[method];

  if (req.user) {
    request.user = deepCopy(req.user);
  }

  if (req.body) {
    request.body = deepCopy(req.body);
  }

  const activities = createActivity(request, {}, createBucketDataActivity);

  if (activities.length) {
    await service.insert(activities);
  }
}
