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

export interface Challenge {
  show(): string;
  answer(answer: string): Promise<string>;
}

export type TokenScheme = {token: string};
export type ChallengeRes = {
  challenge: string;
  answerUrl: string;
};

export interface LoginWithStrategyResponse {
  /**
   * Login url of the identity provider that is necessary to start the login process.
   */
  url: string;
  /**
   * Observable that sends the token of user or challenge of login process
   */
  token: Observable<string | Challenge>;
}

export interface FactorSchema {
  type: string;
  title: string;
  description: string;
  config: {[key: string]: {type: string; enum?: any[]}};
}

export interface FactorMeta {
  type: string;
  config: {[key: string]: any};
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
