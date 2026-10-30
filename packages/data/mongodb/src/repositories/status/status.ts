import {Inject, Injectable, Logger} from "@nestjs/common";
import {BaseCollection, DatabaseService, ObjectId} from "@spica-server/database";
import {
  ApiStatus,
  ApiStatusSummary,
  STATUS_OPTIONS,
  StatusOptions,
  StatusRepository
} from "@spica-server/interface-status";

@Injectable()
export class MongoStatusRepository
  extends BaseCollection<ApiStatus>("status")
  implements StatusRepository
{
  private readonly logger = new Logger(MongoStatusRepository.name);

  constructor(
    db: DatabaseService,
    @Inject(STATUS_OPTIONS) private readonly retention: StatusOptions
  ) {
    super(db);
  }

  async applyExpiry() {
    await this.upsertTTLIndex(this.retention.expireAfterSeconds);
  }

  record(status: Omit<ApiStatus, "_id" | "count">) {
    return this.insertOne(status);
  }

  async insertOne(status: Omit<ApiStatus, "_id" | "count">): Promise<any> {
    const currentMinuteObjectId = this.getCurrentMinuteObjectId();
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return this._coll.updateOne(
          {_id: currentMinuteObjectId},
          {
            $inc: {
              count: 1,
              "request.size": status.request.size,
              "response.size": status.response.size
            },
            $setOnInsert: {
              _id: currentMinuteObjectId,
              created_at: new Date()
            }
          },
          {upsert: true}
        );
      } catch (error: any) {
        // Try again ONLY for duplicate key errors
        if (error?.code === 11000 && attempt < MAX_RETRIES) {
          continue;
        }
        this.logger.error(
          `Error inserting status`,
          error instanceof Error ? error.stack : String(error)
        );
        return;
      }
    }
  }

  summarize(createdBetween?: {from: Date; to: Date}): Promise<ApiStatusSummary> {
    const pipeline: object[] = [
      {
        $group: {
          _id: null,
          request: {$sum: "$count"},
          uploaded: {$sum: "$request.size"},
          downloaded: {$sum: "$response.size"}
        }
      }
    ];

    if (createdBetween) {
      pipeline.unshift({
        $match: {
          _id: {
            $gte: this.objectIdFromDate(createdBetween.from),
            $lt: this.objectIdFromDate(createdBetween.to)
          }
        }
      });
    }

    return this.aggregate<ApiStatusSummary>(pipeline)
      .toArray()
      .then(r => (r.length ? r[0] : {request: 0, uploaded: 0, downloaded: 0}));
  }

  getCurrentMinuteObjectId(): ObjectId {
    const seconds = Math.floor(Date.now() / 1000);
    const minuteSeconds = Math.floor(seconds / 60) * 60;

    const hexTimestamp = minuteSeconds.toString(16).padStart(8, "0");

    return new ObjectId(hexTimestamp + "0000000000000000");
  }

  objectIdFromDate(date: Date): ObjectId {
    const seconds = Math.floor(date.getTime() / 1000);
    const hex = seconds.toString(16).padStart(8, "0");
    return new ObjectId(hex + "0000000000000000");
  }
}
