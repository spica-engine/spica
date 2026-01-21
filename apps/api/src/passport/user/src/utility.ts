import {UserService} from "./user.service";
import {schemaDiff} from "@spica-server/core/differ";
import {ChangeKind} from "@spica-server/interface/core";

export function registerPolicyAttacher(policy: string | string[]) {
  policy = Array.isArray(policy) ? policy : [policy];
  return req => {
    if (isOwnselfAccess(req) && !isAttributeUpdate(req)) {
      req.user.policies = Array.from(new Set(req.user.policies.concat(policy)));
    }
    return req;
  };
}

function isOwnselfAccess(req) {
  return req.params.id == req.user._id;
}

function isAttributeUpdate(req) {
  return (
    req.method == "PUT" &&
    JSON.stringify(req.body.attributes) != JSON.stringify(req.user.attributes)
  );
}

export function provideSettingsFinalizer(userService: UserService) {
  return (previousSchema: any, currentSchema: any) => {
    const targets = schemaDiff(previousSchema.user.attributes, currentSchema.user.attributes)
      .filter(change => {
        if (change.kind == ChangeKind.Add) {
          return false;
        }

        if (change.lastPath.length) {
          if (change.lastPath.includes("type")) {
            return true;
          }
          return false;
        }

        return true;
      })
      // for array targets
      .map(change => change.path.join(".").replace(/\/\[0-9]\*\//g, "$[]"))
      .filter(change => change != "");

    const unsetFields = {};

    for (const target of targets) {
      const path = "attributes." + target;
      unsetFields[path] = "";
    }

    if (!Object.keys(unsetFields).length) {
      return;
    }

    return userService.updateMany({}, {$unset: unsetFields});
  };
}

export function providePolicyFinalizer(userService: UserService) {
  return (policyId: string) => {
    return userService.updateMany({policies: {$in: [policyId]}}, {$pull: {policies: policyId}});
  };
}
