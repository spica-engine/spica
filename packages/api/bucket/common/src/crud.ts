import * as expression from "@spica-server/bucket-expression";

export function applyFieldLevelAcl(
  document: any,
  properties: Record<string, {acl?: string}>,
  user: any
): any {
  if (!document || !properties) {
    return document;
  }

  const result = {...document};

  for (const key in properties) {
    const acl = properties[key].acl;

    if (acl) {
      const allowed = expression.run(acl, {auth: user}, "match");

      if (!allowed) {
        delete result[key];
      }
    }
  }

  return result;
}

export function authIdToString(req: any) {
  if (req.user && req.user._id) {
    req.user._id = req.user._id.toString();
  }
  return req;
}
