import {RequestService} from "@spica-server/passport/src/options";
import {PassportOptions} from "@spica-server/interface/passport";
import {StrategyService} from "../strategy.service.js";
import {CustomOAuthService} from "./custom.js";
import {GoogleOAuthService} from "./google.js";
import {GithubOAuthService} from "./github.js";
import {FacebookOAuthService} from "./facebook.js";
import {OktaOAuthService} from "./okta.js";
import {Auth0OAuthService} from "./auth0.js";

export function initializeOAuthServices(
  strategyService: StrategyService,
  options: PassportOptions,
  req: RequestService
) {
  return [
    new CustomOAuthService(strategyService, options, req),
    new GoogleOAuthService(strategyService, options, req),
    new GithubOAuthService(strategyService, options, req),
    new FacebookOAuthService(strategyService, options, req),
    new OktaOAuthService(strategyService, options, req),
    new Auth0OAuthService(strategyService, options, req)
  ];
}
