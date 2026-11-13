import {DeletableById, Id, ReplaceableById, Repository} from "@spica-server/interface-data";
import {Strategy} from "./interface.js";

export interface StrategyRepository
  extends Repository<Strategy>, ReplaceableById<Strategy>, DeletableById {
  /**
   * Points both OAuth token requests of the strategy at the redirect uri and resolves to the
   * updated strategy.
   */
  setOAuthRedirectUri(id: Id, redirectUri: string): Promise<Strategy | null>;
}

export const STRATEGY_REPOSITORY = Symbol.for("STRATEGY_REPOSITORY");
