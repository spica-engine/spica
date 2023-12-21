import {BaseCollection, CollStats, DatabaseService} from "@spica-server/database";
import {Inject, Injectable} from "@nestjs/common";
import {ApiStatus, StatusOptions, STATUS_OPTIONS} from "./interface";
import {ObjectId} from "@spica-server/database";

@Injectable()
export class StatusService extends BaseCollection<ApiStatus>("status") {
  moduleOptions: StatusOptions;
  constructor(db: DatabaseService, @Inject(STATUS_OPTIONS) _moduleOptions: StatusOptions) {
    super(db, {afterInit: () => this.upsertTTLIndex(_moduleOptions.expireAfterSeconds)});
    this.moduleOptions = _moduleOptions;

    this.trackDocumentCountStats();
  }

  trackDocumentCountStats() {
    if (!this.moduleOptions.totalDocumentsLogInterval) {
      return;
    }

    const logDocumentCountStats = async () => {
      const docCounts: string[] = [];

      const collStats = await this.getCollStats();
      for (const [collName, stat] of Object.entries(collStats)) {
        docCounts.push(`${collName}: ${stat.count}`);
      }

      const docCountsStr = docCounts.sort((a, b) => a.localeCompare(b)).join(", ");
      const message = `status-total-documents-log: ${docCountsStr}`;
      console.log(message);
    };

    logDocumentCountStats();
    setInterval(() => logDocumentCountStats(), this.moduleOptions.totalDocumentsLogInterval);
  }

  async getCollStats() {
    const colls = await this.db.collections();
    const result: {[collName: string]: CollStats} = {};

    await Promise.all(
      colls.map(coll =>
        coll.stats().then(stat => {
          result[coll.collectionName] = stat;
        })
      )
    );

    return result;
  }

  /*
  getCollStats() {
    return this.db.collections().then(async colls => {
      const result = {};
      const promises = [];

      for (const col of colls) {
        const promise = col.stats().then(stat => {
          result[col.collectionName] = stat.count
          const log = `${col.collectionName}: ${stat.count}`;
          results.push(log);
        });
        pros.push(pro);
      }

      await Promise.all(pros);

      const totalDocumentsLog = results.sort((r1, r2) => r1.localeCompare(r2)).join(", ");
      const log = `status-total-documents-log: ${totalDocumentsLog}`;

      return log;
    });
  }
  */

  private byteToMb(bytes: number) {
    return parseFloat((bytes * Math.pow(10, -6)).toFixed(2));
  }

  async _getStatus(begin: Date, end: Date) {
    const pipeline: any[] = [
      {
        $group: {
          _id: null,
          request: {$sum: 1},
          uploaded: {$sum: "$request.size"},
          downloaded: {$sum: "$response.size"}
        }
      }
    ];

    if (this.isValidDate(begin) && this.isValidDate(end)) {
      pipeline.unshift({
        $match: {
          _id: {
            $gte: ObjectId.createFromTime(begin.getTime() / 1000),
            $lt: ObjectId.createFromTime(end.getTime() / 1000)
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
}
