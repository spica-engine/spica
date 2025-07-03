import {RequestService} from "@spica-server/passport/src/options";
import {PassportOptions} from "@spica-server/interface/passport";
import {StrategyService} from "../strategy.service";
import {CustomOAuthService} from "./custom";
import {GoogleOAuthService} from "./google";
import {GithubOAuthService} from "./github";
import {FacebookOAuthService} from "./facebook";
import {OktaOAuthService} from "./okta";

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
    new OktaOAuthService(strategyService, options, req)
  ];
}
