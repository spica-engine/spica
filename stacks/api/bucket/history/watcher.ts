import {Injectable} from "@nestjs/common";
import {MongoClient, ObjectId} from "@spica-server/database";
import {ChangeKind, diff} from "./differ";
import {HistoryService} from "./history.service";
import {BucketDocument, History} from "./interfaces";
import {schemaDiff} from "./schema";

@Injectable()
export class BucketWatcher {
  constructor(private mongoClient: MongoClient, private historyService: HistoryService) {}

  watch() {
    const stream = this.mongoClient.watch(
      [
        {
          $match: {
            $or: [
              {
                "ns.coll": {
                  $regex: /^bucket_/
                }
              },
              {
                "ns.coll": "buckets"
              }
            ]
          }
        }
      ],
      {
        fullDocument: "updateLookup"
      }
    );

    stream.on("change", async rawChange => {
      if (rawChange.ns.coll === "buckets") {
        if (rawChange.operationType === "delete") {
          await this.historyService.deleteMany({bucket_id: rawChange.documentKey._id});
        } else {
          const bucketSchema = await this.historyService.getPreviousSchema(
            rawChange.documentKey._id
          );
          if (bucketSchema) {
            const changes = schemaDiff(bucketSchema, rawChange.fullDocument).filter(
              ({lastPath, path, kind}) =>
                path.length > 0 &&
                (kind == ChangeKind.Delete ||
                  (kind == ChangeKind.Edit &&
                    (lastPath[0] == "bucket" ||
                      lastPath[0] == "relationType" ||
                      lastPath[0] == "type" ||
                      (lastPath[0] == "options" && lastPath[1] == "translate"))))
            );

            changes.forEach(change => {
              this.historyService.deleteHistoryAtPath(rawChange.documentKey._id, change.path);
            });
          }
        }
      } else {
        switch (rawChange.operationType) {
          case "update":
          case "replace":
            const bucketId = new ObjectId(rawChange.ns.coll.replace(/^bucket_/, ""));
            const documentId = new ObjectId(rawChange.documentKey._id);
            const currentDocument = rawChange.fullDocument as BucketDocument;
            const previousDocument = await this.historyService.getPreviousDocument(
              bucketId,
              documentId
            );

            if (previousDocument) {
              const changes = diff(currentDocument, previousDocument);

              if (changes.length > 0) {
                const history: History = {
                  bucket_id: bucketId,
                  document_id: documentId,
                  changes
                };
                await this.historyService.upsertOne(history);
              } else {
                throw new Error(`
                  Database propagated changes but state of previous and current documents is equal so there is no change in between documents. 
                  This usually happens when there is no replication member that has slaveDelay.
                `);
              }
            }
            break;
          case "delete":
            await this.historyService.deleteMany({
              document_id: new ObjectId(rawChange.documentKey._id)
            });
            break;
        }
      }
    });
  }
}
