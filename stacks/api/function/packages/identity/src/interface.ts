import {Observable} from "rxjs";

export interface Identity {
  _id?: string;
  identifier: string;
  password: string;
  policies?: string[];
  attributes?: object;
}

export interface Strategy {
  _id: string;
  type: string;
  name: string;
  title: string;
}

export function isTokenScheme(tokenOrScheme: TokenSchemeOrChallenge): tokenOrScheme is TokenScheme {
  return typeof tokenOrScheme["token"] == "string";
}

export type TokenScheme = {token: string};
export type RequestTarget = {url: string; method: string};
export type Challenge = {
  challenge: {message: string};
  answer: RequestTarget;
};

export type TokenSchemeOrChallenge = TokenScheme | Challenge;
export type TokenOrChallenge = string | Challenge;

export interface LoginWithStrategyResponse {
  /**
   * Login url of the identity provider that is necessary to start the login process.
   */
  url: string;
  /**
   * Observable that sends the token of the user has logged in
   */
  token: Observable<TokenOrChallenge>;
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
