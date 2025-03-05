import {PassportOptions, RequestService} from "@spica-server/passport/src/options";
import {StrategyService} from "../strategy.service";
import {CustomOAuthService} from "./custom";
import {GoogleOAuthService} from "./google";

export function initializeOAuthServices(
  strategyService: StrategyService,
  options: PassportOptions,
  req: RequestService
) {
  return [
    new CustomOAuthService(strategyService, options, req),
    new GoogleOAuthService(strategyService, options, req)
  ];
}
