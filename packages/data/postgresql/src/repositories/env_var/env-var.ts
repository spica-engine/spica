import {Inject, Injectable} from "@nestjs/common";
import {Orm} from "@spica-server/data-postgresql-orm";
import {Id} from "@spica-server/interface-data";
import {EnvVar, EnvVarRepository} from "@spica-server/interface-env_var";
import {envVars} from "../../entities/index.js";
import {ORM} from "../../orm.js";

@Injectable()
export class PostgresEnvVarRepository implements EnvVarRepository {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  findById(id: Id) {
    return this.orm.findById(envVars, id);
  }

  insert(envVar: EnvVar) {
    return this.orm.insert(envVars, envVar);
  }

  replaceById(id: Id, envVar: EnvVar) {
    return this.orm.replaceById(envVars, id, envVar);
  }

  updateById(id: Id, fields: Partial<EnvVar>) {
    return this.orm.updateById(envVars, id, fields);
  }

  deleteById(id: Id) {
    return this.orm.deleteById(envVars, id);
  }
}
