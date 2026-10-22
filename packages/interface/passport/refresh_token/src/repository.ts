import {Id} from "@spica-server/interface-data";
import {RefreshToken} from "./index.js";

export interface RefreshTokenRepository {
  insert(token: RefreshToken): Promise<RefreshToken>;
  findByToken(token: string): Promise<RefreshToken | null>;
  markUsed(token: string, at: Date): Promise<number>;
  /**
   * Resolves to the updated token without its token value.
   */
  setDisabled(id: Id, disabled: boolean): Promise<RefreshToken | null>;
  deleteById(id: Id): Promise<number>;
}

export const REFRESH_TOKEN_REPOSITORY = Symbol.for("REFRESH_TOKEN_REPOSITORY");
