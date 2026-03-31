import {Injectable} from "@nestjs/common";
import {IncomingOAuthPreset, OAuthStrategy} from "@spica-server/interface/passport";
import {CustomOAuthService} from "./custom";

@Injectable()
export class Auth0OAuthService extends CustomOAuthService {
  _idp = "auth0";

  prepareToInsert(strategy: IncomingOAuthPreset) {
    return {
      type: "oauth",
      name: "Auth0 oauth",
      title: "Auth0 oauth",
      icon: strategy.icon,
      options: {
        idp: this.idp,
        code: {
          base_url: `https://${strategy.options.domain}/authorize`,
          params: {
            client_id: strategy.options.client_id,
            response_type: "code",
            response_mode: "query",
            scope: "openid profile email"
          },
          headers: {},
          method: "get"
        },
        access_token: {
          base_url: `https://${strategy.options.domain}/oauth/token`,
          params: {
            client_id: strategy.options.client_id,
            client_secret: strategy.options.client_secret,
            grant_type: "authorization_code"
          },
          headers: {},
          method: "post"
        },
        identifier: {
          base_url: `https://${strategy.options.domain}/userinfo`,
          params: {},
          headers: {},
          method: "get"
        }
      }
    };
  }

  async getToken(strategy: OAuthStrategy, code?: string) {
    strategy.options.access_token.data = {
      ...(strategy.options.access_token.params || {}),
      code
    };
    strategy.options.access_token.params = undefined;

    const tokenResponse = await this.sendRequest(strategy.options.access_token);
    if (!tokenResponse.access_token) {
      throw Error("Access token could not find.");
    }
    return tokenResponse;
  }
}
