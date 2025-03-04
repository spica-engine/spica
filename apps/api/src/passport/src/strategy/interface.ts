import {ObjectId} from "@spica-server/database";

export interface Strategy {
  _id: ObjectId;
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

export interface OAuthStrategy extends Strategy {
  options: {
    // basicly we send request for getting code, then we exhange code for getting access token, then we get user email by using acces token
    code: OAuthRequestDetails;
    access_token: OAuthRequestDetails;
    identifier: OAuthRequestDetails;
    revoke?: OAuthRequestDetails;
  };
}

export interface StrategyTypeService {
  readonly type: string;

  getStrategy(id: string): Promise<Strategy>;

  prepareToInsert(strategy: Strategy);

  afterInsert?(strategy: Strategy);

  getLoginUrl(
    strategy: Strategy
  ): {url: string; state: string} | Promise<{url: string; state: string}>;

  assert(strategy: Strategy, body?: unknown, code?: string): Promise<any>;

  createMetadata?(id: String): any;
}

export interface StrategyTypeServices {
  find: (type: string, idp?: string) => StrategyTypeService;
}
