export interface Strategy {
  _id?: string;
  type: string;
  name: string;
  title: string;
  icon: string;
  callbackUrl?: string;
  [index: string]: any;
}

export function emptyStrategy() {
  return {
    type: "saml",
    name: undefined,
    title: undefined,
    icon: undefined,
    options: {
      ip: {
        login_url: undefined,
        logout_url: undefined,
        certificate: undefined
      },
      sp: undefined
    }
  };
}
