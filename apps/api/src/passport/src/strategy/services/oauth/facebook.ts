import {Injectable} from "@nestjs/common";
import {IncomingOAuthPreset, OAuthStrategy} from "@spica-server/interface/passport";
import {CustomOAuthService} from "./custom";

@Injectable()
export class FacebookOAuthService extends CustomOAuthService {
  _idp = "facebook";

  prepareToInsert(strategy: IncomingOAuthPreset) {
    return {
      type: "oauth",
      name: "Facebook oauth",
      title: "Facebook oauth",
      icon: strategy.icon,
      options: {
        idp: this.idp,
        code: {
          base_url: "https://www.facebook.com/v22.0/dialog/oauth",
          params: {
            client_id: strategy.options.client_id
          },
          headers: {},
          method: "get"
        },
        access_token: {
          base_url: "https://graph.facebook.com/v22.0/oauth/access_token",
          params: {
            client_id: strategy.options.client_id,
            client_secret: strategy.options.client_secret
          },
          headers: {},
          method: "get"
        },
        identifier: {
          base_url: "https://graph.facebook.com/v22.0/me",
          params: {
            fields: "email"
          },
          headers: {},
          method: "get"
        }
      }
    };
  }

  async getIdentifier(strategy: OAuthStrategy, tokenResponse) {
    strategy.options.identifier.params = {
      ...(strategy.options.identifier.params || {}),
      access_token: tokenResponse.access_token
    };

    return this.sendRequest(strategy.options.identifier).then(user => {
      return {user};
    });
  }
}
