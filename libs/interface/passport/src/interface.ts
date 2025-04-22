import {ObjectId} from "@spica-server/database";

export interface Strategy {
  _id?: ObjectId;
  type: string;
  name: string;
  title: string;
  icon: string;
  [index: string]: any;
}

export interface SamlStrategy extends Strategy {
  options: {
    sp: {
      certificate: string;
      private_key: string;
    };
    ip: {
      login_url: string;
      logout_url: string;
      certificate: string;
    };
  };
}

export interface OAuthRequestDetails {
  base_url: string;
  params: {[key: string]: any};
  method: string;
  headers: {[key: string]: any};
}

export interface IncomingOAuthPreset extends Strategy {
  options: {
    idp: "google" | "facebook" | "github";
    client_id: string;
    client_secret: string;
  };
}

// basicly we send request for getting code, then we exhange code for getting access token, then we get user email by using acces token
interface OAuthOptions {
  code: OAuthRequestDetails;
  access_token: OAuthRequestDetails;
  identifier: OAuthRequestDetails;
  revoke?: OAuthRequestDetails;
}

export interface IncomingCustomOAuth extends Strategy {
  options: {
    idp: "custom";
  } & OAuthOptions;
}

export interface OAuthStrategy extends Strategy {
  options: {
    idp: string;
  } & OAuthOptions;
}

export interface StrategyTypeService {
  readonly type: string;

  getStrategy(id: string): Promise<Strategy>;

  prepareToInsert(strategy: Strategy): Strategy;

  afterInsert?(strategy: Strategy);

  getLoginUrl(
    strategy: Strategy
  ): {url: string; state: string} | Promise<{url: string; state: string}>;

  assert(strategy: Strategy, body?: unknown, code?: string): Promise<any>;

  createMetadata?(id: String): any;
}

export interface OAuthStrategyService extends StrategyTypeService {
  readonly idp: string;

  prepareToInsert(strategy: IncomingCustomOAuth | IncomingOAuthPreset): OAuthStrategy;

  getToken(strategy: OAuthStrategy): Promise<object>;

  getIdentifier(strategy: OAuthStrategy, tokenResponse: object): Promise<object>;
}

export interface StrategyTypeServices {
  find: (type: string, idp?: string) => StrategyTypeService;
}
