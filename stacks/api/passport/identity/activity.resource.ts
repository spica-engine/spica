import {Resource, Action} from "@spica-server/activity/services";

export function createIdentityResource(action: Action, req: any, res: any): Resource {
  let name = "Identity";

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
