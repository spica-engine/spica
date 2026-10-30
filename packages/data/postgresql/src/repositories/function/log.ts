import {Inject, Injectable} from "@nestjs/common";
import {Orm, range, Where} from "@spica-server/data-postgresql-orm";
import {
  FUNCTION_LOG_OPTIONS,
  Log,
  LogOptions,
  LogRepository,
  LogSink
} from "@spica-server/interface-function-log";
import {functionLogs} from "../../entities/index.js";
import {PostgresExpiry} from "../../expiry/index.js";
import {ORM} from "../../orm.js";

@Injectable()
export class PostgresFunctionLogRepository implements LogRepository {
  constructor(
    @Inject(ORM) private readonly orm: Orm,
    @Inject(PostgresExpiry) private readonly expiry: PostgresExpiry,
    @Inject(FUNCTION_LOG_OPTIONS) private readonly retention: LogOptions
  ) {}

  async applyExpiry() {
    await this.expiry.expire(functionLogs, "created_at", this.retention.expireAfterSeconds);
  }

  async deleteByFunction(
    functionId: string,
    options: {createdBetween?: {from: Date; to: Date}; levels?: number[]} = {}
  ) {
    const where: Where = {function: functionId};
    if (options.createdBetween) {
      where.created_at = range(options.createdBetween.from, options.createdBetween.to);
    }
    if (options.levels?.length) {
      where.level = options.levels;
    }
    return this.orm.deleteWhere(functionLogs, where);
  }
}

@Injectable()
export class PostgresFunctionLogSink implements LogSink {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  insert(log: Omit<Log, "_id">) {
    return this.orm.insert(functionLogs, log);
  }
}
