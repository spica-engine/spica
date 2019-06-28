import {Injectable} from "@nestjs/common";
import {
  Collection,
  DatabaseService,
  DeleteWriteOpResultObject,
  ObjectId,
  ReplaceWriteOpResult
} from "@spica-server/database";
import {BucketHistory} from "./interfaces";

@Injectable()
export class HistoryService {
  readonly collection: Collection<BucketHistory>;
  constructor(private db: DatabaseService) {
    this.collection = this.db.collection<BucketHistory>("history");
  }

  findBetweenNow(id: ObjectId) {
    return this.collection.find({_id: {$gte: id}}).toArray();
  }

  getHistory(historyId: ObjectId): Promise<BucketHistory> {
    return this.collection.findOne({_id: historyId});
  }

  getHistoryByBucketDataId(bucketDataId: ObjectId): Promise<BucketHistory[]> {
    return this.collection
      .find<BucketHistory>({bucket_data_id: bucketDataId})
      .project({bucket_data_id: 1, title: 1, date: 1})
      .toArray();
  }

  deleteFieldHistory(bucketId: ObjectId, changedField: string[]) {
    return this.collection
      .updateMany(
        {bucket_id: bucketId},
        {
          $pull: {
            changes: {
              path: {$in: [changedField]}
            }
          }
        }
      )
      .then(() => {
        // Delete history data without change data
        console.log(
          "\x1b[31m%s\x1b[0m",
          `History of the following fields are deleted:\x1b[0m ${changedField.join(", ")}`
        );
        this.collection.deleteMany({changes: {$size: 0}});
      });
  }

  deleteMany(filter: Object): Promise<DeleteWriteOpResultObject> {
    console.log("\x1b[31m%s\x1b[0m", `All history deleted ${JSON.stringify(filter)}`);
    return this.collection.deleteMany(filter);
  }

  saveHistory(history: BucketHistory): Promise<ReplaceWriteOpResult> {
    return this.collection.replaceOne({_id: history._id}, history, {
      upsert: true
    });
  }
}
