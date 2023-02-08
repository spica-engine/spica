import {Injectable, Inject} from "@nestjs/common";
import {BaseCollection, DatabaseService, MongoClient} from "@spica-server/database";
import {REPLICATION_SERVICE_OPTIONS, ReplicationServiceOptions, JobMeta} from "../interface";

@Injectable()
export class JobService extends BaseCollection<JobMeta>("jobs") {
  constructor(
    db: DatabaseService,
    client: MongoClient,
    @Inject(REPLICATION_SERVICE_OPTIONS) options: ReplicationServiceOptions
  ) {
    super(db, client, {afterInit: () => this.upsertTTLIndex(options.expireAfterSeconds)});
  }
}
