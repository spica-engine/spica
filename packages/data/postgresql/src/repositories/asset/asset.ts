import {Inject, Injectable} from "@nestjs/common";
import {assertFilterLanguage} from "@spica-server/data";
import {Orm} from "@spica-server/data-postgresql-orm";
import {Asset, AssetRepository} from "@spica-server/interface-asset";
import {Id} from "@spica-server/interface-data";
import {assets} from "../../entities/index.js";
import {ORM} from "../../orm.js";
import {expressionWhere} from "../expression-where.js";

@Injectable()
export class PostgresAssetRepository implements AssetRepository {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  async find(filter?: object | string) {
    assertFilterLanguage(filter, ["expression"], "PostgreSQL");
    return this.orm.findMany(
      assets,
      expressionWhere(assets, typeof filter == "string" ? filter : undefined),
      {orderBy: {_id: "asc"}}
    );
  }

  findById(id: Id) {
    return this.orm.findById(assets, id);
  }

  findVersions(url: string) {
    return this.orm.findMany(assets, {url}, {orderBy: {_id: "asc"}});
  }

  insert(asset: Asset) {
    return this.orm.insert(assets, asset);
  }

  replaceById(id: Id, asset: Asset) {
    return this.orm.replaceById(assets, id, asset, {returning: "before"});
  }

  updateById(id: Id, fields: Partial<Asset>) {
    return this.orm.updateById(assets, id, fields, {returning: "before"});
  }

  deleteById(id: Id) {
    return this.orm.deleteById(assets, id);
  }
}
