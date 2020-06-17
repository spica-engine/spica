import {Injectable} from "@nestjs/common";
import {BucketDocument, Bucket} from "@spica-server/bucket/services";
import {ObjectId} from "@spica-server/database";
import {ChangeKind, diff} from "./differ";
import {HistoryService} from "./history.service";
import {History} from "./interfaces";
import {schemaDiff} from "./schema";

@Injectable()
export class BucketWatcher {
  constructor(private historyService: HistoryService) {}

  updateHistories(previousSchema: Bucket, currentSchema: Bucket) {
    const changes = schemaDiff(previousSchema, currentSchema).filter(
      ({lastPath, path, kind}) =>
        path.length > 0 &&
        (kind == ChangeKind.Delete ||
          (kind == ChangeKind.Edit &&
            (lastPath[0] == "bucket" ||
              lastPath[0] == "relationType" ||
              lastPath[0] == "type" ||
              (lastPath[0] == "options" && lastPath[1] == "translate"))))
    );
    return Promise.all(
      changes.map(change => this.historyService.deleteHistoryAtPath(currentSchema._id, change.path))
    );
  }

  createHistory(
    bucketId: ObjectId,
    previousDocument: BucketDocument,
    currentDocument: BucketDocument
  ) {
    const changes = diff(currentDocument, previousDocument);
    if (changes.length > 0) {
      const history: History = {
        bucket_id: bucketId,
        document_id: currentDocument._id,
        changes
      };
      return this.historyService.insertOne(history);
    }
  }

  clearHistories(filter: {document_id?: ObjectId; bucket_id?: ObjectId}) {
    return this.historyService.deleteMany(filter);
  }
}
