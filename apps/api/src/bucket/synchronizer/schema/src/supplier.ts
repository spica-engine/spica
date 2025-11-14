import {Observable} from "rxjs";
import {BucketService} from "@spica-server/bucket/services";
import YAML from "yaml";
import {
  ChangeLog,
  ChangeSupplier,
  ChangeType,
  ChangeOrigin
} from "@spica-server/interface/versioncontrol";

const module = "bucket";
const subModule = "schema";
const fileExtension = "yaml";

export const supplier = (bs: BucketService): ChangeSupplier => {
  return {
    module,
    subModule,
    fileExtension,
    listen(): Observable<ChangeLog> {
      return new Observable(observer => {
        bs._coll
          .find()
          .toArray()
          .then(buckets => {
            buckets.forEach(bucket => {
              const changeLog: ChangeLog = {
                module,
                sub_module: subModule,
                origin: ChangeOrigin.DOCUMENT,
                type: ChangeType.CREATE,
                resource_id: bucket._id.toString(),
                resource_slug: bucket.title,
                resource_content: YAML.stringify(bucket),
                created_at: new Date()
              };
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
          let changeData: Pick<
            ChangeLog,
            "type" | "resource_id" | "resource_slug" | "resource_content"
          >;

          switch (change.operationType) {
            case "insert":
              changeData = {
                type: ChangeType.CREATE,
                resource_id: change.fullDocument._id.toString(),
                resource_slug: change.fullDocument.title,
                resource_content: YAML.stringify(change.fullDocument)
              };
              break;

            case "replace":
            case "update":
              changeData = {
                type: ChangeType.UPDATE,
                resource_id: change.documentKey._id.toString(),
                resource_slug: change.fullDocument.title,
                resource_content: YAML.stringify(change.fullDocument)
              };
              break;

            case "delete":
              changeData = {
                type: ChangeType.DELETE,
                resource_id: change.documentKey._id.toString(),
                resource_slug: null,
                resource_content: ""
              };
              break;
            default:
              console.warn("Unknown operation type:", change.operationType);
              break;
          }

          if (changeData) {
            const changeLog: ChangeLog = {
              module,
              sub_module: subModule,
              origin: ChangeOrigin.DOCUMENT,
              created_at: new Date(),
              ...changeData
            };
            observer.next(changeLog);
          }
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
