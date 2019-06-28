export const EMPTY_IDENTITY: Identity = {
  identifier: undefined,
  password: undefined,
  first_name: undefined,
  last_name: undefined,
  email: undefined,
  phone: undefined,
  additional: undefined,
  policies: []
};

export interface Identity {
  _id?: string;
  identifier: string;
  password: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  additional?: string;
  policies: string[];
}
