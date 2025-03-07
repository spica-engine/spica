import {Injectable} from "@nestjs/common";
import {IncomingOAuthPreset, OAuthStrategy} from "../../interface";
import {CustomOAuthService} from "./custom";

@Injectable()
export class GoogleOAuthService extends CustomOAuthService {
  _idp = "google";

  prepareToInsert(strategy: IncomingOAuthPreset) {
    return {
      type: "oauth",
      name: "Google oauth",
      title: "Google oauth",
      icon: strategy.icon,
      options: {
        idp: this.idp,
        code: {
          base_url: "https://accounts.google.com/o/oauth2/v2/auth",
          params: {
            client_id: strategy.options.client_id,
            response_type: "code",
            scope: "email"
          },
          headers: {},
          method: "get"
        },
        access_token: {
          base_url: "https://oauth2.googleapis.com/token",
          params: {
            client_id: strategy.options.client_id,
            client_secret: strategy.options.client_secret,
            grant_type: "authorization_code"
          },
          headers: {},
          method: "post"
        },
        identifier: {
          base_url: "https://www.googleapis.com/oauth2/v2/userinfo",
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
