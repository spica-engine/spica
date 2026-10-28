import {Inject, Injectable} from "@nestjs/common";
import {Orm} from "@spica-server/data-postgresql-orm";
import {Asset, AssetRepository} from "@spica-server/interface-asset";
import {Id} from "@spica-server/interface-data";
import {assets} from "../../entities/index.js";
import {ORM} from "../../orm.js";

@Injectable()
export class PostgresAssetRepository implements AssetRepository {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  find(filter?: object) {
    if (filter && Object.keys(filter).length) {
      throw new Error("Filtering assets is not supported on PostgreSQL yet.");
    }
    return this.orm.findMany(assets, {}, {orderBy: {_id: "asc"}});
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
