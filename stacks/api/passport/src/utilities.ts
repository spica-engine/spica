import {StrategyTypeService} from "./strategy/interface";

export function getStrategyService(services: StrategyTypeService[], type: string) {
  return services.find(s => s.type == type);
}
