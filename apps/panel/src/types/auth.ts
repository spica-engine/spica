// TODO: update attributes and failedAttempts with appropriate types
export type AuthTokenJWTPayload = {
  _id: string;
  identifier: string;
  policies: string[];
  attributes: {[key: string]: any};
  failedAttempts: any[];
  lastLogin: string;
  iat: number;
  exp: number;
  aud: string;
  iss: string;
};
