import { Injectable, Inject } from "@nestjs/common";
import { BaseCollection, DatabaseService } from "@spica-server/database";
import { CommandMessage, REPLICATION_SERVICE_OPTIONS, ReplicationServiceOptions } from "../interface";

@Injectable()
export class ProcessService extends BaseCollection<CommandMessage>("processes") {
  constructor(
    db: DatabaseService,
    @Inject(REPLICATION_SERVICE_OPTIONS) options: ReplicationServiceOptions
  ) {
    super(db, { afterInit: () => this.upsertTTLIndex(options.expireAfterSeconds) });
  }
}
