import {Injectable} from "@nestjs/common";
import {BucketDocument} from "@spica-server/bucket/services";
import {BaseCollection, DatabaseService, ObjectId} from "@spica-server/database";

@Injectable()
export class BucketDataService {
  constructor(private db: DatabaseService) {}

  children(id: string | ObjectId) {
    const coll = BaseCollection<BucketDocument>(getBucketDataCollection(id));
    return new coll(this.db);
  }
}

export function getBucketDataCollection(bucketId: string | ObjectId): string {
  return `bucket_${bucketId}`;
}
