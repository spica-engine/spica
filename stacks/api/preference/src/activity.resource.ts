import {Action} from "@spica-server/activity/services";

export function createPreferenceResource(action: Action, req: any, res: any): string[] {
  let documentId: string[] = [req.params.scope];

  return ["preference", ...documentId];
}
