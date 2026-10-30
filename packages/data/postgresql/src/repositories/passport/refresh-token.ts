import {Inject, Injectable} from "@nestjs/common";
import {Orm} from "@spica-server/data-postgresql-orm";
import {Id} from "@spica-server/interface-data";
import {RefreshToken, RefreshTokenRepository} from "@spica-server/interface-passport-refresh_token";
import {refreshTokens} from "../../entities/index.js";
import {ORM} from "../../orm.js";
import {omitPaths} from "../helpers.js";

@Injectable()
export class PostgresRefreshTokenRepository implements RefreshTokenRepository {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  async applyExpiry() {}

  insert(token: RefreshToken) {
    return this.orm.insert(refreshTokens, token);
  }

  findByToken(token: string) {
    return this.orm.findOne(refreshTokens, {token});
  }

  async markUsed(token: string, at: Date) {
    const updated = await this.orm.updateMany(refreshTokens, {token}, {last_used_at: at});
    return updated.length;
  }

  async setDisabled(id: Id, disabled: boolean) {
    return omitPaths(await this.orm.updateById(refreshTokens, id, {disabled}), ["token"]);
  }

  async deleteById(id: Id) {
    return (await this.orm.deleteById(refreshTokens, id)) ? 1 : 0;
  }
}
