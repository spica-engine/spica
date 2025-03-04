import {PassportOptions, RequestService} from "@spica-server/passport/src/options";
import {StrategyService} from "../strategy.service";
import {CustomOAuthService} from "./custom";

export function initializeOAuthServices(
  strategyService: StrategyService,
  options: PassportOptions,
  req: RequestService
) {
  return [new CustomOAuthService(strategyService, options, req)];
}
