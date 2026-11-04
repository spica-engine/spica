import {ApiKeyRepository} from "@spica-server/interface-passport-apikey";

export function providePolicyFinalizer(apiKeys: ApiKeyRepository) {
  return (policyId: string) => apiKeys.removePolicyFromAll(policyId);
}
