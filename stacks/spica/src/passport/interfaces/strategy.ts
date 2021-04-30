export interface Strategy {
  _id?: string;
  type: string;
  name: string;
  title: string;
  icon: string;
  callbackUrl?: string;
  [index: string]: any;
}

export const emptySamlOptions = {
  ip: {
    login_url: undefined,
    logout_url: undefined,
    certificate: undefined
  },
  sp: undefined
};

export const emptyOAuthOptions = {
  code: {
    base_url: undefined,
    params: {scope: "email"},
    headers: {},
    method: "get"
  },
  access_token: {
    base_url: undefined,
    params: {},
    headers: {},
    method: "get"
  },
  identifier: {
    base_url: undefined,
    params: {},
    headers: {},
    method: "get"
  }
};

export function emptyStrategy() {
  return {
    type: "saml",
    name: undefined,
    title: undefined,
    icon: undefined,
    options: emptySamlOptions
  };
}
