import {Resource, Action} from "@spica-server/activity/src";

export function createApikeyResource(action: Action, req: any, res: any): Resource {
  let name = "APIKEY";

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

export function createApikeyPolicyResource(action: Action, req: any, res: any): Resource {
  let name = "APIKEY";
  let documentId = [req.params.id];

  let subResource: Resource = {
    name: "POLICY",
    documentId: req.body
  };

  return {name, documentId, subResource};
}
