import {Predict, Action} from "@spica-server/interface/activity";

export function getAction(action: string): Action {
  return Action[action];
}

export function getUser(user: any) {
  return user ? user._id : undefined;
}

export function createActivity(req: any, res: any, predict: Predict) {
  const identifier = getUser(req.user);

  if (!identifier) {
    console.log(`Identifier was not sent.`);
    return [];
  }

  const action = getAction(req.method);

  return predict({identifier, action}, req, res);
}
