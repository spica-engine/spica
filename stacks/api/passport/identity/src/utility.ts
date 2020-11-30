import {IdentityService} from "./identity.service";
import {schemaDiff, ChangeKind} from "@spica-server/core/differ";

export function attachIdentityAccess(request: any) {
  if (
    request.method == "PUT" &&
    request.params.id == request.user._id &&
    !request.user.policies.includes("IdentityFullAccess")
  ) {
    request.user.policies.push("IdentityFullAccess");
  }
  return request;
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
      .map(change => change.path.join(".").replace(/\/\[0-9]\*\//g, "$[]"));

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
