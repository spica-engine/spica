import {Injectable} from "@nestjs/common";
import {IncomingOAuthPreset, OAuthStrategy} from "@spica-server/interface/passport";
import {CustomOAuthService} from "./custom";

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

  getIdentifier(strategy: OAuthStrategy, tokenResponse) {
    strategy.options.identifier.headers = {
      Authorization: `Bearer ${tokenResponse.access_token}`
    };

    return this.sendRequest(strategy.options.identifier).then(user => {
      return {user};
    });
  }
}
