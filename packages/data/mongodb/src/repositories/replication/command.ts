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
    @Inject(REPLICATION_SERVICE_OPTIONS) options: ReplicationServiceOptions
  ) {
    super(db, {afterInit: () => this.upsertTTLIndex(options.expireAfterSeconds)});
  }

  insert(command: CommandMessage) {
    return this._coll.insertOne(command);
  }
}
