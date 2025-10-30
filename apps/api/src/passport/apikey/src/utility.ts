import {ApiKeyService} from "./apikey.service";
import {customAlphabet} from "nanoid";

export function providePolicyFinalizer(apikeyService: ApiKeyService) {
  return (policyId: string) => {
    return apikeyService.updateMany({policies: {$in: [policyId]}}, {$pull: {policies: policyId}});
  };
}

export function generateUniqueApiKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+";
  const generateApiKey = customAlphabet(chars, 32);
  const key = generateApiKey();
  return key;
}
