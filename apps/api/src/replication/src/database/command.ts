import {Injectable, Inject} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "../../../../../../libs/database";
import {
  CommandMessage,
  REPLICATION_SERVICE_OPTIONS,
  ReplicationServiceOptions
} from "../../../../../../libs/interface/replication";

@Injectable()
export class CommandService extends BaseCollection<CommandMessage>("commands") {
  constructor(
    db: DatabaseService,
    @Inject(REPLICATION_SERVICE_OPTIONS) options: ReplicationServiceOptions
  ) {
    super(db, {afterInit: () => this.upsertTTLIndex(options.expireAfterSeconds)});
  }
}
