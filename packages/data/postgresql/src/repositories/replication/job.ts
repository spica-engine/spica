import {Inject, Injectable} from "@nestjs/common";
import {Orm} from "@spica-server/data-postgresql-orm";
import {JobMeta, JobRepository} from "@spica-server/interface-replication";
import {jobs, StoredJob} from "../../entities/index.js";
import {ORM} from "../../orm.js";

const toStored = ({_id, event_id, created_at, ...payload}: JobMeta): StoredJob => ({
  key: _id,
  event_id,
  created_at,
  payload
});

const toMeta = ({key, event_id, created_at, payload}: StoredJob): JobMeta => ({
  ...payload,
  _id: key,
  ...(event_id === undefined ? {} : {event_id}),
  ...(created_at === undefined ? {} : {created_at})
});

@Injectable()
export class PostgresJobRepository implements JobRepository {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  async applyExpiry() {}

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
