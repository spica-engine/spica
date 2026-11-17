import {Inject, Injectable} from "@nestjs/common";
import {jsonbSet, Orm} from "@spica-server/data-postgresql-orm";
import {Id} from "@spica-server/interface-data";
import {Strategy, StrategyRepository} from "@spica-server/interface-passport";
import {strategies} from "../../entities/index.js";
import {ORM} from "../../orm.js";

@Injectable()
export class PostgresStrategyRepository implements StrategyRepository {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  findById(id: Id) {
    return this.orm.findById(strategies, id);
  }

  insert(strategy: Strategy) {
    return this.orm.insert(strategies, strategy);
  }

  replaceById(id: Id, strategy: Strategy) {
    return this.orm.replaceById(strategies, id, strategy);
  }

  async deleteById(id: Id) {
    return (await this.orm.deleteById(strategies, id)) ? 1 : 0;
  }

  async setOAuthRedirectUri(id: Id, redirectUri: string) {
    return this.orm.updateById(strategies, id, {
      options: jsonbSet({
        "code.params.redirect_uri": redirectUri,
        "access_token.params.redirect_uri": redirectUri
      })
    });
  }
}
