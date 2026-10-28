import {Inject, Injectable} from "@nestjs/common";
import {Orm} from "@spica-server/data-postgresql-orm";
import {Id} from "@spica-server/interface-data";
import {ApiKey} from "@spica-server/interface-passport-apikey";
import {ApiKeyRepository} from "@spica-server/interface-passport-apikey";
import {apiKeys} from "../../entities/index.js";
import {ORM} from "../../orm.js";
import {addPolicy, removePolicy, removePolicyFromAll} from "../helpers.js";

@Injectable()
export class PostgresApiKeyRepository implements ApiKeyRepository {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  findById(id: Id) {
    return this.orm.findById(apiKeys, id);
  }

  findActiveByKey(key: string) {
    return this.orm.findOne(apiKeys, {key, active: true});
  }

  insert(apiKey: ApiKey) {
    return this.orm.insert(apiKeys, apiKey);
  }

  updateById(id: Id, changes: Partial<ApiKey>) {
    return this.orm.updateById(apiKeys, id, changes);
  }

  replaceById(id: Id, apiKey: ApiKey) {
    return this.orm.replaceById(apiKeys, id, apiKey);
  }

  async deleteById(id: Id) {
    return (await this.orm.deleteById(apiKeys, id)) ? 1 : 0;
  }

  addPolicy(id: Id, policyId: string) {
    return addPolicy(this.orm, apiKeys, id, policyId);
  }

  removePolicy(id: Id, policyId: string) {
    return removePolicy(this.orm, apiKeys, id, policyId);
  }

  removePolicyFromAll(policyId: string) {
    return removePolicyFromAll(this.orm, apiKeys, policyId);
  }
}
