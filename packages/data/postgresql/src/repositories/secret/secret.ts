import {Inject, Injectable} from "@nestjs/common";
import {Orm} from "@spica-server/data-postgresql-orm";
import {Id} from "@spica-server/interface-data";
import {Secret, SecretRepository} from "@spica-server/interface-secret";
import {secrets} from "../../entities/index.js";
import {ORM} from "../../orm.js";

@Injectable()
export class PostgresSecretRepository implements SecretRepository {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  findById(id: Id) {
    return this.orm.findById(secrets, id);
  }

  insert(secret: Secret) {
    return this.orm.insert(secrets, secret);
  }

  replaceById(id: Id, secret: Secret) {
    return this.orm.replaceById(secrets, id, secret, {returning: "before"});
  }

  updateById(id: Id, fields: Partial<Secret>) {
    return this.orm.updateById(secrets, id, fields, {returning: "before"});
  }

  deleteById(id: Id) {
    return this.orm.deleteById(secrets, id);
  }
}
