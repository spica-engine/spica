import {Resource, Action} from "@spica-server/activity/src";

export function createPreferenceResource(action: Action, req: any, res: any): Resource {
  let name = "PREFERENCE";

  let documentId: string[] = [req.params.scope];

  return {name, documentId};
}
