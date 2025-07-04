import {Injectable} from "@nestjs/common";
import {IncomingOAuthPreset, OAuthStrategy} from "@spica-server/interface/passport";
import {CustomOAuthService} from "./custom";
import qs from "qs";

@Injectable()
export class OktaOAuthService extends CustomOAuthService {
  _idp = "okta";

  prepareToInsert(strategy: IncomingOAuthPreset) {
    return {
      type: "oauth",
      name: "Okta oauth",
      title: "Okta oauth",
      icon: strategy.icon,
      options: {
        idp: this.idp,
        code: {
          base_url: `https://${strategy.options.domain}/oauth2/v1/authorize`,
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
          base_url: `https://${strategy.options.domain}/oauth2/v1/token`,
          params: {
            client_id: strategy.options.client_id,
            client_secret: strategy.options.client_secret,
            grant_type: "authorization_code"
          },
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          method: "post"
        },
        identifier: {
          base_url: `https://${strategy.options.domain}/oauth2/v1/userinfo`,
          params: {},
          headers: {},
          method: "get"
        }
      }
    };
  }

  async getToken(strategy: OAuthStrategy, code?: string) {
    strategy.options.access_token.data = qs.stringify({
      ...(strategy.options.access_token.params || {}),
      code
    });
    strategy.options.access_token.params = undefined;

    const tokenResponse = await this.sendRequest(strategy.options.access_token);
    if (!tokenResponse.access_token) {
      throw Error("Access token could not find.");
    }
    return tokenResponse;
  }
}
