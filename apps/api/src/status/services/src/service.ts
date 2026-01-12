import {BaseCollection, DatabaseService, InsertOneResult} from "@spica-server/database";
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
    this.createIndex({timestamp: 1});
  }

  private byteToMb(bytes: number) {
    return parseFloat((bytes * Math.pow(10, -6)).toFixed(2));
  }

  async insertOne(status: Omit<ApiStatus, "timestamp" | "count">): Promise<any> {
    const currentMinuteTimestamp = this.getCurrentMinuteTimestamp();
    return this._coll.updateOne(
      {timestamp: currentMinuteTimestamp},
      {
        $inc: {
          count: 1,
          "request.size": status.request.size,
          "response.size": status.response.size
        },
        $setOnInsert: {
          timestamp: currentMinuteTimestamp
        }
      },
      {upsert: true}
    );
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
      pipeline.unshift({
        $match: {
          timestamp: {
            $gte: begin,
            $lt: end
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

  private getCurrentMinuteTimestamp() {
    return new Date(Math.floor(Date.now() / 60000) * 60000);
  }
}
