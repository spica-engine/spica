import {Observable} from "rxjs";
import {EnvVarService} from "../../services";
import * as CRUD from "../../src/crud";
import {EnvVar} from "@spica-server/interface/env_var";
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
import {ObjectId} from "@spica-server/database";

const module = "env-var";
const subModule = "schema";
const fileExtension = "yaml";

export const envVarSupplier = (evs: EnvVarService): ChangeSupplier => {
  return {
    module,
    subModule,
    fileExtension,
    listen(): Observable<ChangeLog> {
      return new Observable(observer => {
        const stream = evs._coll.watch([], {
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
                resource_slug: change.fullDocument.key,
                resource_content: YAML.stringify(change.fullDocument)
              };
              break;

            case "replace":
            case "update":
              changeData = {
                type: ChangeType.UPDATE,
                resource_id: change.documentKey._id.toString(),
                resource_slug: change.fullDocument.key,
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

export const envVarApplier = (evs: EnvVarService): ChangeApplier => {
  return {
    module,
    subModule,
    fileExtension,
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const {type, resource_id, resource_content} = change;

        if (type === ChangeType.DELETE) {
          await CRUD.remove(evs, resource_id);
          return {status: SyncStatuses.SUCCEEDED};
        }

        if (!resource_content) {
          return {
            status: SyncStatuses.FAILED,
            reason: `Unknown operation type: ${type}`
          };
        }

        const envVar: EnvVar = YAML.parse(resource_content);
        envVar._id = new ObjectId(resource_id);

        switch (type) {
          case ChangeType.CREATE:
            await CRUD.insert(evs, envVar);
            break;

          case ChangeType.UPDATE:
            await CRUD.replace(evs, envVar);
            break;
        }

        return {status: SyncStatuses.SUCCEEDED};
      } catch (error: any) {
        console.warn("Error applying env_var change:", error);
        return {status: SyncStatuses.FAILED, reason: error.message};
      }
    }
  };
};
