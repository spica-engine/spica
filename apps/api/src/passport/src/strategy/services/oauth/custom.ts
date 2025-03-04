import {OAuthStrategy} from "../../interface";
import {CommonOAuthService} from "./common";

export class CustomOAuthService extends CommonOAuthService {
  readonly idp = "custom";

  getUser(strategy: OAuthStrategy, tokenResponse) {
    strategy.options.identifier.params = {
      ...(strategy.options.identifier.params || {}),
      access_token: tokenResponse.access_token
    };

    // some services only accept token on Authorization header
    strategy.options.identifier.headers = {
      Authorization: `token ${tokenResponse.access_token}`
    };

    return this.sendRequest(strategy.options.identifier).then(user => {
      return {user};
    });
  }
}
