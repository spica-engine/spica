import {Injectable} from "@nestjs/common";
import {BucketDataService, BucketService} from "@spica-server/bucket/services";
import {MongoClient, ObjectId} from "@spica-server/database";
import * as cron from "cron";

@Injectable()
export class DocumentScheduler {
  private scheduleMap = new Map<string, cron.CronJob>();

  constructor(database: MongoClient, private bds: BucketDataService, private bs: BucketService) {
    this.bs.find().then(buckets => {
      for (const bucket of buckets) {
        this.bds
          .children(bucket)
          .updateMany({_schedule: {$lt: new Date()}}, {$unset: {_schedule: ""}});
      }
    });

    const watcher = database.watch([
      {
        $match: {
          "ns.coll": {
            $regex: /^bucket_/
          },
          "fullDocument._schedule": {$type: "date"}
        }
      }
    ]);
    watcher.on("change", change => {
      this.schedule(
        new ObjectId(change.ns.coll.replace(/^bucket_/, "")),
        new ObjectId(change.documentKey._id),
        new Date(change.fullDocument._schedule)
      );
    });
  }
  schedule(bucket: ObjectId, document: ObjectId, time: Date) {
    const key = `${bucket}_${document}`;

    // @TODO: TEST HERE BEFORE SEND CHANGES
    const publish = async () => {
      const schema = await this.bs.findOne({_id: bucket});
      return this.bds.children(schema).updateOne({_id: document}, {$unset: {_schedule: ""}});
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
