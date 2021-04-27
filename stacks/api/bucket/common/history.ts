import {BucketDocument, BucketService} from "@spica-server/bucket/services";
import {HistoryService} from "@spica-server/bucket/history";
import {ObjectId} from "@spica-server/database";

export function createHistory(
  bs: BucketService,
  history: HistoryService,
  bucketId: ObjectId,
  previousDocument: BucketDocument,
  currentDocument: BucketDocument
) {
  return bs.findOne({_id: bucketId}).then(bucket => {
    if (bucket && bucket.history) {
      return history.createHistory(bucketId, previousDocument, currentDocument);
    }
  });
}
