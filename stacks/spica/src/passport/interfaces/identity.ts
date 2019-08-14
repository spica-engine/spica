export function emptyIdentity(): Identity {
  return {
    identifier: undefined,
    password: undefined,
    policies: [],
    attributes: {}
  };
}

export interface Identity {
  _id?: string;
  identifier: string;
  password: string;
  policies: string[];
  attributes?: {
    [key: string]: any;
  };
}
