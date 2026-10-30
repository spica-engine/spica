import {Injectable, Inject} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {
  COMMAND_COLLECTION,
  CommandMessage,
  CommandRepository,
  REPLICATION_SERVICE_OPTIONS,
  ReplicationServiceOptions
} from "@spica-server/interface-replication";

@Injectable()
export class MongoCommandRepository
  extends BaseCollection<CommandMessage>(COMMAND_COLLECTION)
  implements CommandRepository
{
  constructor(
    db: DatabaseService,
    @Inject(REPLICATION_SERVICE_OPTIONS) private readonly retention: ReplicationServiceOptions
  ) {
    super(db);
  }

  async applyExpiry() {
    await this.upsertTTLIndex(this.retention.expireAfterSeconds);
  }

  insert(command: CommandMessage) {
    return this._coll.insertOne(command);
  }
}
