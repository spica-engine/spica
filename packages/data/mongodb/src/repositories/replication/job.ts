import {Inject, Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {
  JobMeta,
  JobRepository,
  REPLICATION_SERVICE_OPTIONS,
  ReplicationServiceOptions
} from "@spica-server/interface-replication";

@Injectable()
export class MongoJobRepository extends BaseCollection<JobMeta>("jobs") implements JobRepository {
  constructor(
    db: DatabaseService,
    @Inject(REPLICATION_SERVICE_OPTIONS) private readonly retention: ReplicationServiceOptions
  ) {
    super(db);
  }

  async applyExpiry() {
    await this.upsertTTLIndex(this.retention.expireAfterSeconds);
  }

  claim(meta: JobMeta) {
    return this._coll
      .updateOne({_id: meta._id}, {$setOnInsert: {...meta, created_at: new Date()}}, {upsert: true})
      .catch(e => {
        // If replicas are triggered at the same time(before upsert completion), this error occurs.
        // for this case, we can ignore the error since we know one of replicas already took the job
        if (e.code == 11000) {
          return {upsertedCount: 0};
        }
        throw Error(e);
      })
      .then(({upsertedCount}) => !!upsertedCount);
  }

  takeByEventId(eventId: string) {
    return this._coll.findOneAndDelete({event_id: eventId});
  }
}
