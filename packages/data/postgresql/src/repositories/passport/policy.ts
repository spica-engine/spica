import {Inject, Injectable} from "@nestjs/common";
import {Orm} from "@spica-server/data-postgresql-orm";
import {Id} from "@spica-server/interface-data";
import {Policy, PolicyRepository} from "@spica-server/interface-passport-policy";
import {policies} from "../../entities/index.js";
import {ORM} from "../../orm.js";

@Injectable()
export class PostgresPolicyRepository implements PolicyRepository {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  findAll() {
    return this.orm.findMany(policies, {}, {orderBy: {_id: "asc"}});
  }

  findById(id: Id) {
    return this.orm.findById(policies, id);
  }

  insert(policy: Policy) {
    return this.orm.insert(policies, policy as Partial<Policy>);
  }

  async replaceById(id: Id, policy: Policy) {
    return (await this.orm.replaceById(policies, id, policy)) ? 1 : 0;
  }

  async deleteById(id: Id) {
    return (await this.orm.deleteById(policies, id)) ? 1 : 0;
  }
}
