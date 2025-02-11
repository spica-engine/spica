import {IdentityService} from "./identity.service";
import {schemaDiff, ChangeKind} from "@spica-server/core/differ";

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

export function provideSettingsFinalizer(identityService: IdentityService) {
  return (previousSchema: any, currentSchema: any) => {
    const targets = schemaDiff(
      previousSchema.identity.attributes,
      currentSchema.identity.attributes
    )
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

    return identityService.updateMany({}, {$unset: unsetFields});
  };
}

export function providePolicyFinalizer(identityService: IdentityService) {
  return (policyId: string) => {
    return identityService.updateMany({policies: {$in: [policyId]}}, {$pull: {policies: policyId}});
  };
}
