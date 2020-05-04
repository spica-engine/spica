import {Action} from "@spica-server/activity/services";

export function createBucketResource(action: Action, req: any, res: any): string[] {
  let documentId: string[] = [];
  switch (action) {
    case Action.POST:
      documentId.push(res._id.toString());
      break;
    case Action.PUT:
      documentId.push(req.params.id);
      break;
    case Action.DELETE:
      documentId.push(req.params.id);
      break;
  }

  return ["bucket", ...documentId];
}

export function createBucketDataResource(action: Action, req: any, res: any): string[] {
  let documentId: string[] = [];

  switch (action) {
    case Action.POST:
      documentId.push(res._id.toString());
      break;
    case Action.PUT:
      documentId.push(req.params.documentId);
      break;
    case Action.DELETE:
      if (req.params.documentId) {
        documentId.push(req.params.documentId);
      } else {
        documentId = req.body;
      }
      break;
  }

  return ["bucket", req.params.bucketId.toString(), ...documentId];
}
