import {PasswordPolicy} from "@spica-server/interface/config";

export function applyPasswordPolicy(baseSchema: object, policy?: PasswordPolicy): object {
  const schema = JSON.parse(JSON.stringify(baseSchema));

  if (!policy || !schema["properties"]?.["password"]) {
    return schema;
  }

  const passwordProp = schema["properties"]["password"];

  if (policy.minLength && policy.minLength > 0) {
    passwordProp["minLength"] = policy.minLength;
  }

  const lookaheads: string[] = [];

  if (policy.minLowercase && policy.minLowercase > 0) {
    lookaheads.push(`(?=(?:.*[a-z]){${policy.minLowercase}})`);
  }

  if (policy.minUppercase && policy.minUppercase > 0) {
    lookaheads.push(`(?=(?:.*[A-Z]){${policy.minUppercase}})`);
  }

  if (policy.minNumber && policy.minNumber > 0) {
    lookaheads.push(`(?=(?:.*\\d){${policy.minNumber}})`);
  }

  if (policy.minSpecialCharacter && policy.minSpecialCharacter > 0) {
    lookaheads.push(`(?=(?:.*[^a-zA-Z\\d\\s]){${policy.minSpecialCharacter}})`);
  }

  if (lookaheads.length > 0) {
    passwordProp["pattern"] = `^${lookaheads.join("")}.*$`;
  }

  return schema;
}
