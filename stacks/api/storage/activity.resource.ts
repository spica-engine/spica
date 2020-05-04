import {Action} from "@spica-server/activity/services";

export function createStorageResource(action: Action, req: any, res: any): string[] {
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

  return ["storage", ...documentId];
}
