import {Injectable, Inject} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {
  REPLICATION_SERVICE_OPTIONS,
  ReplicationServiceOptions,
  JobMeta
} from "@spica-server/interface/replication";

@Injectable()
export class JobService extends BaseCollection<JobMeta>("jobs") {
  constructor(
    db: DatabaseService,
    @Inject(REPLICATION_SERVICE_OPTIONS) options: ReplicationServiceOptions
  ) {
    super(db, {afterInit: () => this.upsertTTLIndex(options.expireAfterSeconds)});
  }
}
