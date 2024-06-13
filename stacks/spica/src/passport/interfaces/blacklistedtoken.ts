export interface BlacklistedToken {
  _id?: string;
  token: string;
  expires_in: Date;
}

export function emptyBlacklistedToken(): BlacklistedToken {
  return {
    token: undefined,
    expires_in: new Date()
  };
}
