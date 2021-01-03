export interface Identity {
  _id?: string;
  identifier: string;
  password: string;
  policies?: string[];
  attributes?: object;
}
