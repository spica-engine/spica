import {Observable} from "rxjs";
import {BucketService} from "@spica-server/bucket/services";
import YAML from "yaml";
import {
  ChangeLog,
  ChangeType,
  ChangeOrigin,
  DocumentChangeSupplier
} from "@spica-server/interface/versioncontrol";
import {Bucket} from "@spica-server/interface/bucket";

const module = "bucket";
const subModule = "schema";
const fileExtension = "yaml";

const getChangeLogFromBucket = (bucket: Bucket, type: ChangeType): ChangeLog => {
  return {
    module,
    sub_module: subModule,
    origin: ChangeOrigin.DOCUMENT,
    type: type,
    resource_id: bucket._id.toString(),
    resource_slug: bucket.title,
    resource_content: YAML.stringify(bucket),
    resource_extension: fileExtension,
    created_at: new Date()
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
              const changeLog = getChangeLogFromBucket(bucket, ChangeType.CREATE);
              observer.next(changeLog);
            });
          })
          .catch(error => {
            console.error("Error propagating existing buckets:", error);
          });

        const stream = bs._coll.watch([], {
          fullDocument: "updateLookup"
        });

        stream.on("change", change => {
          let changeType: ChangeType;

          switch (change.operationType) {
            case "insert":
              changeType = ChangeType.CREATE;
              break;

            case "replace":
            case "update":
              changeType = ChangeType.UPDATE;
              break;

            case "delete":
              changeType = ChangeType.DELETE;
              break;
            default:
              console.warn("Unknown operation type:", change.operationType);
              return;
          }

          const changeLog = getChangeLogFromBucket(change["fullDocument"], changeType);
          observer.next(changeLog);
        });

        stream.on("error", error => {
          observer.error(error);
        });

        return () => {
          if (!stream.closed) {
            stream.close();
          }
        };
      });
    }
  };
};
