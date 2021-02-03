import {
  Action,
  PreActivity,
  ModuleActivity,
  createActivity,
  ActivityService
} from "@spica-server/activity/services";

export function createBucketActivity(
  preActivity: PreActivity,
  req: any,
  res: any
): ModuleActivity[] {
  const activities: ModuleActivity[] = [];

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
  preActivity: PreActivity,
  req: any,
  res: any
): ModuleActivity[] {
  const activities: ModuleActivity[] = [];

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
        resource: [
          "bucket",
          req.params.bucketId.toString(),
          "data",
          req.params.documentId.toString()
        ]
      });
      break;
    case Action.PATCH:
      activities.push({
        ...preActivity,
        resource: [
          "bucket",
          req.params.bucketId.toString(),
          "data",
          req.params.documentId.toString()
        ]
      });
      break;
    case Action.DELETE:
      if (req.params.documentId) {
        activities.push({
          ...preActivity,
          resource: [
            "bucket",
            req.params.bucketId.toString(),
            "data",
            req.params.documentId.toString()
          ]
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

export function insertActivity(
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

  return createActivity(
    {
      switchToHttp: () => ({
        getRequest: () => request
      })
    } as any,
    response,
    createBucketDataActivity,
    service
  );
}

function deepCopy(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}
