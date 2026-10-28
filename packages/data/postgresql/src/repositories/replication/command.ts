import {Inject, Injectable} from "@nestjs/common";
import {Orm} from "@spica-server/data-postgresql-orm";
import {CommandMessage, CommandRepository} from "@spica-server/interface-replication";
import {commands} from "../../entities/index.js";
import {ORM} from "../../orm.js";

@Injectable()
export class PostgresCommandRepository implements CommandRepository {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  insert(command: CommandMessage) {
    return this.orm.insert(commands, command);
  }
}
