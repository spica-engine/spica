import {Observable} from "rxjs";
import {BucketDataService, BucketService} from "@spica-server/bucket/services";
import {HistoryService} from "@spica-server/bucket/history";
import * as CRUD from "../../src/crud";
import {Bucket} from "@spica-server/interface/bucket";
import YAML from "yaml";
import {
  ChangeLog,
  ChangeSupplier,
  ChangeApplier,
  ApplyResult
} from "@spica-server/interface/versioncontrol/src/interface";

const module = "bucket";
const subModule = "schema";
const fileExtension = "yaml";

export const bucketSupplier = (bs: BucketService): ChangeSupplier => {
  return {
    module,
    subModule,
    fileExtension,
    listen(): Observable<ChangeLog> {
      return new Observable(observer => {
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
                type: "insert",
                resource_id: change.fullDocument._id.toString(),
                resource_slug: change.fullDocument.title,
                resource_content: YAML.stringify(change.fullDocument)
              };
              break;

            case "replace":
            case "update":
              changeData = {
                type: "update",
                resource_id: change.documentKey._id.toString(),
                resource_slug: change.fullDocument.title,
                resource_content: YAML.stringify(change.fullDocument)
              };
              break;

            case "delete":
              changeData = {
                type: "delete",
                resource_id: change.documentKey._id.toString(),
                resource_slug: "",
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
              origin: "local",
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

export const bucketApplier = (
  bs: BucketService,
  bds: BucketDataService,
  history: HistoryService
): ChangeApplier => {
  return {
    module,
    subModule,
    fileExtension,
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const operationType = change.type;
        const bucket: Bucket = YAML.parse(change.resource_content);

        switch (operationType) {
          case "insert":
            await CRUD.insert(bs, bucket);
            return {status: "succeeded"};

          case "update":
            await CRUD.replace(bs, bds, history, bucket);
            return {status: "succeeded"};

          case "delete":
            await CRUD.remove(bs, bds, history, change.resource_id);
            return {status: "succeeded"};

          default:
            console.warn("Unknown operation type:", operationType);
            return {status: "failed", reason: `Unknown operation type: ${operationType}`};
        }
      } catch (error) {
        console.warn("Error applying bucket change:", error);
        return {status: "failed", reason: error.message};
      }
    }
  };
};
