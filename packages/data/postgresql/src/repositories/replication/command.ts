import {Inject, Injectable} from "@nestjs/common";
import {Orm} from "@spica-server/data-postgresql-orm";
import {
  CommandMessage,
  CommandRepository,
  REPLICATION_SERVICE_OPTIONS,
  ReplicationServiceOptions
} from "@spica-server/interface-replication";
import {commands} from "../../entities/index.js";
import {PostgresExpiry} from "../../expiry/index.js";
import {ORM} from "../../orm.js";

@Injectable()
export class PostgresCommandRepository implements CommandRepository {
  constructor(
    @Inject(ORM) private readonly orm: Orm,
    @Inject(PostgresExpiry) private readonly expiry: PostgresExpiry,
    @Inject(REPLICATION_SERVICE_OPTIONS) private readonly retention: ReplicationServiceOptions
  ) {}

  async applyExpiry() {
    await this.expiry.expire(commands, "created_at", this.retention.expireAfterSeconds);
  }

  insert(command: CommandMessage) {
    return this.orm.insert(commands, command);
  }
}
