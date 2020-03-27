import {Resource, Action} from "@spica-server/activity";

export function createBucketResource(action: Action, req: any, res: any): Resource {
  let name = "BUCKET";

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

  return {name, documentId};
}

export function createBucketDataResource(action: Action, req: any, res: any): Resource {
  let name = "BUCKET";
  let documentId = [req.params.bucketId];

  let subDocumentId: string[] = [];
  switch (action) {
    case Action.POST:
      subDocumentId.push(res._id.toString());
      break;
    case Action.PUT:
      subDocumentId.push(req.params.documentId);
      break;
    case Action.DELETE:
      if (req.params.documentId) {
        subDocumentId.push(req.params.documentId);
      } else {
        subDocumentId = req.body;
      }
      break;
  }

  let subResource: Resource = {
    name: "BUCKET-DATA",
    documentId: subDocumentId
  };

  return {name, documentId, subResource};
}
