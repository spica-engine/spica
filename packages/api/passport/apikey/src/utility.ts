import {ApiKeyService} from "./apikey.service.js";

export function providePolicyFinalizer(apikeyService: ApiKeyService) {
  return (policyId: string) => {
    return apikeyService.updateMany({policies: {$in: [policyId]}}, {$pull: {policies: policyId}});
  };
}
