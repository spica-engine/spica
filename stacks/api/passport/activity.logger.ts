import {Activity, Action} from "@spica-server/activity";

export function createApiKeyActivity(req, res): Activity {
  const action = Object.values(Action)[Object.keys(Action).findIndex(val => val === req.method)];
  let activity = {
    action: action,
    module: "APIKEY",
    identifier: req.user ? (req.user.identifier ? req.user.identifier : undefined) : undefined,
    documentId: undefined,
    date: new Date()
  };
  if (action == Action.POST) {
    activity.documentId = res._id ? res._id : undefined;
  } else {
    activity.documentId = req.params ? (req.params.id ? req.params.id : undefined) : undefined;
  }
  return activity;
}
