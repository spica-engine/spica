import {Injectable} from "@nestjs/common";
import {IncomingOAuthPreset, OAuthStrategy} from "@spica-server/interface/passport";
import {CustomOAuthService} from "./custom";

@Injectable()
export class GithubOAuthService extends CustomOAuthService {
  _idp = "github";

  prepareToInsert(strategy: IncomingOAuthPreset) {
    return {
      type: "oauth",
      name: "Github oauth",
      title: "Github oauth",
      icon: strategy.icon,
      options: {
        idp: this.idp,
        code: {
          base_url: "https://github.com/login/oauth/authorize",
          params: {
            client_id: strategy.options.client_id,
            scope: "user"
          },
          headers: {},
          method: "get"
        },
        access_token: {
          base_url: "https://github.com/login/oauth/access_token",
          params: {
            client_id: strategy.options.client_id,
            client_secret: strategy.options.client_secret
          },
          headers: {
            Accept: "application/json"
          },
          method: "post"
        },
        identifier: {
          base_url: "https://api.github.com/user",
          params: {},
          headers: {},
          method: "get"
        }
      }
    };
  }
}
