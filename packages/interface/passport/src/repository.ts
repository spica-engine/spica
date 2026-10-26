import {Id} from "@spica-server/interface-data";
import {Strategy} from "./interface.js";

export interface StrategyRepository {
  findById(id: Id): Promise<Strategy | null>;
  insert(strategy: Strategy): Promise<Strategy>;
  replaceById(id: Id, strategy: Strategy): Promise<Strategy | null>;
  deleteById(id: Id): Promise<number>;
  /**
   * Points both OAuth token requests of the strategy at the redirect uri and resolves to the
   * updated strategy.
   */
  setOAuthRedirectUri(id: Id, redirectUri: string): Promise<Strategy | null>;
}

export const STRATEGY_REPOSITORY = Symbol.for("STRATEGY_REPOSITORY");
