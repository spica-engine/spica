import {Inject, Injectable} from "@nestjs/common";
import {jsonbSet, Orm} from "@spica-server/data-postgresql-orm";
import {BaseConfig, ConfigRepository} from "@spica-server/interface-config";
import {configs} from "../../entities/index.js";
import {ORM} from "../../orm.js";

@Injectable()
export class PostgresConfigRepository implements ConfigRepository {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  findByModule(module: string) {
    return this.orm.findOne(configs, {module});
  }

  replaceByModule(module: string, config: BaseConfig) {
    return this.orm.upsert(
      configs,
      {...config, module},
      {conflict: ["module"], update: ["options"]}
    );
  }

  async setOptions(module: string, options: object) {
    await this.orm.upsert(configs, {module, options}, {conflict: ["module"], update: ["options"]});
  }

  async setOption(module: string, name: string, value: unknown) {
    const initial = name
      .split(".")
      .reduceRight<unknown>((nested, key) => ({[key]: nested}), value) as object;
    await this.orm.upsert(
      configs,
      {module, options: initial},
      {conflict: ["module"], set: {options: jsonbSet({[name]: value})}}
    );
  }
}
