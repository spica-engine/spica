import {Injectable, Inject} from "@nestjs/common";
import {BaseCollection, DatabaseService, MongoClient} from "@spica-server/database";
import {CommandMessage, REPLICATION_SERVICE_OPTIONS, ReplicationServiceOptions} from "../interface";

@Injectable()
export class CommandService extends BaseCollection<CommandMessage>("commands") {
  constructor(
    db: DatabaseService,
    client: MongoClient,
    @Inject(REPLICATION_SERVICE_OPTIONS) options: ReplicationServiceOptions
  ) {
    super(db, client, {afterInit: () => this.upsertTTLIndex(options.expireAfterSeconds)});
  }
}
