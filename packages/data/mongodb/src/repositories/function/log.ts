import {Inject, Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, ObjectId} from "@spica-server/database";
import {
  FUNCTION_LOG_OPTIONS,
  Log,
  LogOptions,
  LogRepository,
  LogSink
} from "@spica-server/interface-function-log";

@Injectable()
export class MongoFunctionLogRepository
  extends BaseCollection<Log>("function_logs")
  implements LogRepository
{
  constructor(
    db: DatabaseService,
    @Inject(FUNCTION_LOG_OPTIONS) private readonly retention: LogOptions
  ) {
    super(db);
  }

  async applyExpiry() {
    await Promise.all([
      this.upsertTTLIndex(this.retention.expireAfterSeconds),
      this._coll.createIndex({function: 1, _id: -1})
    ]);
  }

  deleteByFunction(
    functionId: string,
    options: {createdBetween?: {from: Date; to: Date}; levels?: number[]} = {}
  ) {
    const filter: any = {function: functionId};

    if (options.createdBetween) {
      filter._id = {
        $gte: ObjectId.createFromTime(options.createdBetween.from.getTime() / 1000),
        $lt: ObjectId.createFromTime(options.createdBetween.to.getTime() / 1000)
      };
    }

    if (options.levels && options.levels.length) {
      filter.level = {$in: options.levels};
    }

    return this.deleteMany(filter);
  }
}

/**
 * Writes worker logs without the TTL index setup of the log repository, which the function
 * module's log repository owns.
 */
@Injectable()
export class MongoFunctionLogSink implements LogSink {
  constructor(private readonly db: DatabaseService) {}

  insert(log: Omit<Log, "_id">) {
    return this.db.collection("function_logs").insertOne(log);
  }
}
