import {Injectable} from "@nestjs/common";
import {BucketDocument, Bucket, LimitExceedBehaviours} from "@spica-server/bucket/services/src";
import {BaseCollection, DatabaseService, ObjectId} from "@spica-server/database";

@Injectable()
export class BucketDataService {
  constructor(private db: DatabaseService) {}

  children(schema: Bucket) {
    const coll = BaseCollection<BucketDocument>(getBucketDataCollection(schema._id));
    let options: any = {};

    if (
      schema.documentSettings &&
      schema.documentSettings.limitExceedBehaviour == LimitExceedBehaviours.PREVENT
    ) {
      options.countLimit = schema.documentSettings.countLimit;
    }

    return new coll(this.db, options);
  }
}

export function getBucketDataCollection(bucketId: string | ObjectId): string {
  return `bucket_${bucketId}`;
}
