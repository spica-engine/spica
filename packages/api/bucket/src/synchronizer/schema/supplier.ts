import {Observable} from "rxjs";
import {BucketService} from "@spica-server/bucket-services";
import YAML from "yaml";
import {
  ChangeLog,
  ChangeType,
  ChangeOrigin,
  DocumentChangeSupplier,
  ChangeInitiator
} from "@spica-server/interface-versioncontrol";
import {Bucket} from "@spica-server/interface-bucket";
import {Logger} from "@nestjs/common";

const logger = new Logger("BucketSyncSupplier");

const module = "bucket";
const subModule = "schema";
const fileExtension = "yaml";

const getChangeLogFromBucket = (
  bucket: Bucket,
  type: ChangeType,
  initiator: ChangeInitiator,
  eventId: string
): ChangeLog => {
  return {
    module,
    sub_module: subModule,
    origin: ChangeOrigin.DOCUMENT,
    type: type,
    resource_id: bucket._id.toString(),
    resource_slug: bucket.title,
    resource_content: YAML.stringify(bucket),
    resource_extension: fileExtension,
    created_at: new Date(),
    initiator,
    event_id: eventId
  };
};

export const getSupplier = (bs: BucketService): DocumentChangeSupplier => {
  return {
    module,
    subModule,
    listen(): Observable<ChangeLog> {
      return new Observable(observer => {
        bs._coll
          .find()
          .toArray()
          .then(buckets => {
            buckets.forEach(bucket => {
              const changeLog = getChangeLogFromBucket(
                bucket,
                ChangeType.CREATE,
                ChangeInitiator.INTERNAL,
                bucket._id.toString()
              );
              observer.next(changeLog);
            });
          })
          .catch(error => {
            logger.error(
              "Error propagating existing buckets:",
              error instanceof Error ? error.stack : String(error)
            );
          });

        const subs = bs
          .watch([], {
            fullDocument: "updateLookup",
            fullDocumentBeforeChange: "required"
          })
          .subscribe({
            next: change => {
              let changeType: ChangeType;
              let documentData: Bucket | undefined;

              switch (change.operationType) {
                case "insert":
                  changeType = ChangeType.CREATE;
                  documentData = change["fullDocument"];
                  break;

                case "replace":
                case "update":
                  changeType = ChangeType.UPDATE;
                  documentData = change["fullDocument"];
                  break;

                case "delete":
                  changeType = ChangeType.DELETE;
                  documentData = change["fullDocumentBeforeChange"];
                  break;
                default:
                  logger.warn(`Unknown operation type: ${change.operationType}`);
                  return;
              }

              const changeLog = getChangeLogFromBucket(
                documentData,
                changeType,
                ChangeInitiator.EXTERNAL,
                JSON.stringify(change._id)
              );
              observer.next(changeLog);
            },
            error: err => {
              observer.error(err);
            }
          });

        return () => {
          subs.unsubscribe();
        };
      });
    }
  };
};
