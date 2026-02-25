import {UserService} from "./user.service";

export function registerPolicyAttacher(policy: string | string[]) {
  policy = Array.isArray(policy) ? policy : [policy];
  return req => {
    if (isOwnselfAccess(req)) {
      req.user.policies = Array.from(new Set(req.user.policies.concat(policy)));
    }
    return req;
  };
}

function isOwnselfAccess(req) {
  return req.params.id == req.user._id;
}

export function providePolicyFinalizer(userService: UserService) {
  return (policyId: string) => {
    return userService.updateMany({policies: {$in: [policyId]}}, {$pull: {policies: policyId}});
  };
}
