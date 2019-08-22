import {Injectable} from "@nestjs/common";
import {MongoClient, ObjectId} from "@spica-server/database";
import * as cron from "cron";
import {BucketDocument} from "./bucket";
import {BucketDataService} from "./bucket-data.service";
import {BucketService} from "./bucket.service";

@Injectable()
export class DocumentScheduler {
  private scheduleMap = new Map<string, cron.CronJob>();

  constructor(database: MongoClient, private bds: BucketDataService, private bs: BucketService) {
    this.bs.find().then(buckets => {
      for (const bucket of buckets) {
        this.bds.updateMany(bucket._id, {_schedule: {$lt: new Date()}}, {$unset: {_schedule: ""}});
      }
    });

    const watcher = database.watch([
      {
        $match: {
          "ns.coll": {
            $regex: /^bucket_/
          },
          "fullDocument._schedule": {$type: "string"}
        }
      }
    ]);
    watcher.on("change", change => {
      this.schedule(
        new ObjectId(change.ns.coll.replace(/^bucket_/, "")),
        new ObjectId(change.documentKey._id),
        new Date(change.fullDocument._schedule),
        change.fullDocument
      );
    });
  }
  schedule(bucket: ObjectId, document: ObjectId, time: Date, data: BucketDocument) {
    const key = `${bucket}_${document}`;

    const publish = () => {
      delete data._schedule;
      this.bds.replaceOne(bucket, data);
    };

    if (time.getTime() <= Date.now() + 1) {
      return publish();
    }

    if (this.scheduleMap.has(key)) {
      this.scheduleMap.get(key).stop();
      this.scheduleMap.delete(key);
    }

    this.scheduleMap.set(
      key,
      new cron.CronJob({
        cronTime: time,
        start: true,
        onTick: () => publish()
      })
    );
  }
}
