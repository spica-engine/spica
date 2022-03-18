import {Observable} from "rxjs";

interface Identity {
  _id: string;
  identifier: string;
  password: string;
  policies: string[];
  attributes?: object;
}

export type IdentityUpdate = Partial<Identity>;
export type IdentityCreate = Omit<Identity, "_id">;
export type IdentityGet = Omit<Identity, "password">;

export interface Strategy {
  _id: string;
  type: string;
  name: string;
  title: string;
}

export interface LoginWithStrategyResponse {
  /**
   * Login url of the identity provider that is necessary to start the login process.
   */
  url: string;
  /**
   * Observable that sends the token of the user has logged in
   */
  token: Observable<string>;
}

interface InitializeOptions {
  publicUrl?: string;
}

export interface ApikeyInitialization extends InitializeOptions {
  apikey: string;
}

export interface IdentityInitialization extends InitializeOptions {
  identity: string;
}

export interface InitializationResult {
  authorization: string;
  publicUrl: string;
}

export interface IndexResult<T> {
  meta: {
    total: number;
  };
  data: T[];
}
