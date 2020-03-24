import {Resource, Action} from "@spica-server/activity/src";

export function createStorageResource(action: Action, req: any, res: any): Resource {
  let name = "STORAGE";

  let documentId: string[] = [];
  switch (action) {
    case Action.POST:
      documentId = res.map(item => item._id.toString());
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
