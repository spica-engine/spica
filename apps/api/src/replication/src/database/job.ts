import {Injectable, Inject} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "../../../../../../libs/database";
import {
  REPLICATION_SERVICE_OPTIONS,
  ReplicationServiceOptions,
  JobMeta
} from "../../../../../../libs/interface/replication";

@Injectable()
export class JobService extends BaseCollection<JobMeta>("jobs") {
  constructor(
    db: DatabaseService,
    @Inject(REPLICATION_SERVICE_OPTIONS) options: ReplicationServiceOptions
  ) {
    super(db, {afterInit: () => this.upsertTTLIndex(options.expireAfterSeconds)});
  }
}
