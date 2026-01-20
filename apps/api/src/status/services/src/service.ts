import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Inject, Injectable} from "@nestjs/common";
import {ApiStatus, StatusOptions, STATUS_OPTIONS} from "@spica-server/interface/status";
import {ObjectId} from "@spica-server/database";

@Injectable()
export class StatusService extends BaseCollection<ApiStatus>("status") {
  moduleOptions: StatusOptions;
  constructor(db: DatabaseService, @Inject(STATUS_OPTIONS) _moduleOptions: StatusOptions) {
    super(db, {afterInit: () => this.createIndexes(_moduleOptions)});
    this.moduleOptions = _moduleOptions;
  }

  private async createIndexes(options: StatusOptions) {
    await this.upsertTTLIndex(options.expireAfterSeconds);
  }

  private byteToMb(bytes: number) {
    return parseFloat((bytes * Math.pow(10, -6)).toFixed(2));
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
              _id: currentMinuteObjectId
            }
          },
          {upsert: true}
        );
      } catch (error: any) {
        // Try again ONLY for duplicate key errors
        if (error?.code === 11000 && attempt < MAX_RETRIES) {
          continue;
        }
        console.error(`Error inserting status`, error);
        return;
      }
    }
  }

  async _getStatus(begin: Date, end: Date) {
    const pipeline: any[] = [
      {
        $group: {
          _id: null,
          request: {$sum: "$count"},
          uploaded: {$sum: "$request.size"},
          downloaded: {$sum: "$response.size"}
        }
      }
    ];

    if (this.isValidDate(begin) && this.isValidDate(end)) {
      const beginObjectId = this.objectIdFromDate(begin);
      const endObjectId = this.objectIdFromDate(end);
      pipeline.unshift({
        $match: {
          _id: {
            $gte: beginObjectId,
            $lt: endObjectId
          }
        }
      });
    }

    const result = await super
      .aggregate<{request: number; downloaded: number; uploaded: number}>(pipeline)
      .toArray()
      .then(r => {
        return r.length ? r[0] : {request: 0, uploaded: 0, downloaded: 0};
      });
    return {
      request: {
        current: result.request,
        unit: "count"
      },
      uploaded: {
        current: this.byteToMb(result.uploaded),
        unit: "mb"
      },
      downloaded: {
        current: this.byteToMb(result.downloaded),
        unit: "mb"
      }
    };
  }

  private isValidDate(date) {
    return date instanceof Date && !isNaN(date.getTime());
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
