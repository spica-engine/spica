import {Inject, Injectable} from "@nestjs/common";
import {idOf, omitId, withId} from "@spica-server/data";
import {Orm} from "@spica-server/data-postgresql-orm";
import {
  JobMeta,
  JobRepository,
  REPLICATION_SERVICE_OPTIONS,
  ReplicationServiceOptions
} from "@spica-server/interface-replication";
import {jobs, StoredJob} from "../../entities/index.js";
import {PostgresExpiry} from "../../expiry/index.js";
import {ORM} from "../../orm.js";

const toStored = (meta: JobMeta): StoredJob => {
  const {event_id, created_at, ...payload} = omitId(meta);
  return {key: String(idOf(meta)), event_id, created_at, payload};
};

const toMeta = ({key, event_id, created_at, payload}: StoredJob): JobMeta =>
  withId(
    {
      ...payload,
      ...(event_id === undefined ? {} : {event_id}),
      ...(created_at === undefined ? {} : {created_at})
    },
    key
  );

@Injectable()
export class PostgresJobRepository implements JobRepository {
  constructor(
    @Inject(ORM) private readonly orm: Orm,
    @Inject(PostgresExpiry) private readonly expiry: PostgresExpiry,
    @Inject(REPLICATION_SERVICE_OPTIONS) private readonly retention: ReplicationServiceOptions
  ) {}

  async applyExpiry() {
    await this.expiry.expire(jobs, "created_at", this.retention.expireAfterSeconds);
  }

  async claim(meta: JobMeta) {
    const claimed = await this.orm.upsert(jobs, toStored({...meta, created_at: new Date()}), {
      conflict: ["key"],
      update: []
    });
    return !!claimed;
  }

  takeByEventId(eventId: string) {
    return this.orm.transaction(async session => {
      const job = await session.findOne(
        jobs,
        {event_id: eventId},
        {orderBy: {created_at: "asc"}, lock: "update skip locked"}
      );
      if (!job) {
        return null;
      }
      await session.deleteById(jobs, job.id);
      return toMeta(job);
    });
  }
}
