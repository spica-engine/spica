import {Inject, Injectable} from "@nestjs/common";
import {increment, Orm, range, sum} from "@spica-server/data-postgresql-orm";
import {ApiStatus, ApiStatusSummary, StatusRepository} from "@spica-server/interface-status";
import {statuses} from "../../entities/index.js";
import {ORM} from "../../orm.js";

@Injectable()
export class PostgresStatusRepository implements StatusRepository {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  async applyExpiry() {}

  async record(status: Omit<ApiStatus, "_id" | "count">) {
    const minute = new Date();
    minute.setSeconds(0, 0);
    await this.orm.upsert(
      statuses,
      {
        minute,
        count: 1,
        requestSize: status.request.size,
        responseSize: status.response.size
      },
      {
        conflict: ["minute"],
        set: {
          count: increment(1),
          requestSize: increment(status.request.size),
          responseSize: increment(status.response.size)
        }
      }
    );
  }

  summarize(createdBetween?: {from: Date; to: Date}): Promise<ApiStatusSummary> {
    return this.orm.aggregate(
      statuses,
      {request: sum("count"), uploaded: sum("requestSize"), downloaded: sum("responseSize")},
      createdBetween ? {minute: range(createdBetween.from, createdBetween.to)} : {}
    );
  }
}
