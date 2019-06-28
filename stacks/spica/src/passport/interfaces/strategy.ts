export interface Strategy {
  _id?: string;
  type: string;
  name: string;
  title: string;
  icon: string;
  [index: string]: any;
}

export const EMPTY_STRATEGY: Strategy = {
  type: undefined,
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

export function emptyStrategy() {
  return {
    type: undefined,
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
