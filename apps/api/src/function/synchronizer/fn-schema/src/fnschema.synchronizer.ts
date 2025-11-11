import {Observable} from "rxjs";
import {FunctionService} from "@spica-server/function/services";
import {FunctionEngine} from "@spica-server/function/src/engine";
import {LogService} from "@spica-server/function/log";
import * as CRUD from "../../../src/crud";
import {Function} from "@spica-server/interface/function";
import YAML from "yaml";
import {
  ChangeLog,
  ChangeSupplier,
  ChangeApplier,
  ApplyResult,
  ChangeType,
  ChangeOrigin,
  SyncStatuses
} from "@spica-server/interface/versioncontrol";

const module = "function";
const subModule = "schema";
const fileExtension = "yaml";

export const functionSupplier = (fs: FunctionService): ChangeSupplier => {
  return {
    module,
    subModule,
    fileExtension,
    listen(): Observable<ChangeLog> {
      return new Observable(observer => {
        const stream = fs._coll.watch([], {
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
                resource_slug: change.fullDocument.name,
                resource_content: YAML.stringify(change.fullDocument)
              };
              break;

            case "replace":
            case "update":
              changeData = {
                type: ChangeType.UPDATE,
                resource_id: change.documentKey._id.toString(),
                resource_slug: change.fullDocument.name,
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

export const functionApplier = (
  fs: FunctionService,
  engine: FunctionEngine,
  logs: LogService
): ChangeApplier => {
  return {
    module,
    subModule,
    fileExtension,
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const operationType = change.type;
        const fn: Function = YAML.parse(change.resource_content);

        switch (operationType) {
          case ChangeType.CREATE:
            await CRUD.insert(fs, engine, fn);
            return {status: SyncStatuses.SUCCEEDED};

          case ChangeType.UPDATE:
            await CRUD.replace(fs, engine, fn);
            return {status: SyncStatuses.SUCCEEDED};

          case ChangeType.DELETE:
            await CRUD.remove(fs, engine, logs, change.resource_id);
            return {status: SyncStatuses.SUCCEEDED};

          default:
            console.warn("Unknown operation type:", operationType);
            return {
              status: SyncStatuses.FAILED,
              reason: `Unknown operation type: ${operationType}`
            };
        }
      } catch (error) {
        console.warn("Error applying function change:", error);
        return {status: SyncStatuses.FAILED, reason: error.message};
      }
    }
  };
};
