import {DatabaseService, MongoClient, ObjectId, ReadPreference} from "@spica-server/database";
import {Injectable} from "@nestjs/common";
import * as deepDiff from "deep-diff";
import * as diffMatchPatch from "diff-match-patch";
import {BucketDocument} from "../bucket";
import {HistoryService} from "./history.service";
import {BucketChange, BucketHistory} from "./interfaces";

@Injectable()
export class BucketHistorian {
  constructor(
    private mongoClient: MongoClient,
    private db: DatabaseService,
    private historyService: HistoryService
  ) {}
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

    stream.on("change", async change => {
      if (change.ns.coll === "buckets") {
        if (change.operationType === "delete") {
          await this.historyService.deleteMany({bucket_id: change.documentKey._id});
        } else {
          const bucketSchema = await this.db.collection(change.ns.coll).findOne(
            {_id: new ObjectId(change.documentKey._id)},
            {
              readPreference: new ReadPreference(ReadPreference.SECONDARY_PREFERRED, [
                {
                  slaveDelay: "true"
                }
              ])
            }
          );
          if (bucketSchema) {
            const changedFields = this.schemaChanges(
              change.fullDocument["properties"],
              bucketSchema.properties
            );
            if (changedFields && changedFields.length > 0) {
              await this.historyService.deleteFieldHistory(change.documentKey._id, changedFields);
            }
          }
        }
      } else {
        switch (change.operationType) {
          case "update":
          case "replace":
            const id = change.documentKey._id;
            const newData = change.fullDocument as BucketDocument;
            const oldData = await this.db.collection(change.ns.coll).findOne<BucketDocument>(
              {_id: new ObjectId(id)},
              {
                readPreference: new ReadPreference(ReadPreference.SECONDARY_PREFERRED, [
                  {
                    slaveDelay: "true"
                  }
                ])
              }
            );
            if (oldData) {
              const diff = this.differ(newData, oldData);
              if (diff.length > 0) {
                const history: BucketHistory = {
                  bucket_id: new ObjectId(change.ns.coll.replace("bucket_", "")),
                  bucket_data_id: new ObjectId(newData._id),
                  changes: diff,
                  // TODO: _id already contains the creation time. Do we need this?
                  date: Date.now()
                };
                history._id = new ObjectId(history._id);
                await this.historyService.saveHistory(history);
              }
            }
            break;
          case "delete":
            await this.historyService.deleteMany({
              bucket_data_id: new ObjectId(change.documentKey._id)
            });
            break;
          default:
            break;
        }
      }
    });
  }

  /**
   * Differs bucket diff service
   * @param lhs left-hand side operand
   * @param rhs right-hand side operand
   * @returns Array<BucketHistory>
   */
  differ(lhs: BucketDocument, rhs: BucketDocument): BucketChange[] {
    let result: BucketChange[] = [];
    const diffs = deepDiff.diff(lhs, rhs);
    if (diffs) {
      diffs.forEach((diff, index) => {
        if (diff.kind === "E") {
          diff["patch"] = this.shallowDiff(diff.lhs, diff.rhs);
          if (diff["patch"].length == 0) {
            diffs.splice(index, 1);
          } else {
            let rest: BucketChange;
            ({lhs, rhs, ...rest} = diff);
            result.push(rest);
          }
        } // Handling Array Elements
        else if (diff.kind === "A") {
          if (diff.item.kind === "D") {
            diff["patch"] = this.shallowDiff(diff.item.lhs, "");
          } else if (diff.item.kind === "N") {
            diff["patch"] = this.shallowDiff("", diff.item.rhs);
          }
          diff.path.push(diff.index);
          result.push(diff as BucketChange);
        }
      });
    }
    return result;
  }

  /** Compares two strings */
  shallowDiff(lhs, rhs) {
    const gDiff = new diffMatchPatch.diff_match_patch();
    const gDiffResult = gDiff.patch_make(lhs.toString(), rhs.toString());
    return gDiffResult;
  }

  schemaChanges(lhs, rhs): string[] {
    let changedFields: string[] = [];
    const changes = deepDiff.diff(lhs, rhs);
    if (Array.isArray(changes) && changes.length > 0) {
      changes.forEach(diff => {
        switch (diff.kind) {
          case "E":
            if (
              // TODO(tolga): Need better solution for the following check
              diff.path[diff.path.length - 1] !== "description" &&
              diff.path[diff.path.length - 1] !== "title" &&
              (diff.path[diff.path.length - 2] !== "options" ||
                diff.path[diff.path.length - 1] === "translate" ||
                diff.path[diff.path.length - 1] === "readOnly")
            ) {
              if (changedFields.indexOf(diff.path[0]) < 0) {
                changedFields.push(diff.path[0]);
              }
            }
            break;
          case "N":
          case "D":
            if (changedFields.indexOf(diff.path[0]) < 0) {
              changedFields.push(diff.path[0]);
            }
            break;
          default:
            break;
        }
      });
      return changedFields;
    }
  }
}
