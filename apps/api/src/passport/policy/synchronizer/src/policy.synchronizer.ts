import {Observable} from "rxjs";
import {PolicyService} from "../../src/policy.service";
import {changeFactory, Policy} from "@spica-server/interface/passport/policy";
import YAML from "yaml";
import * as CRUD from "../../src/crud";
import {
  ChangeLog,
  ChangeSupplier,
  ChangeApplier,
  ApplyResult,
  ChangeType,
  ChangeOrigin,
  SyncStatuses
} from "@spica-server/interface/versioncontrol";
import {ObjectId} from "bson";

const module = "policy";
const subModule = "schema";
const fileExtension = "yaml";

export function policySupplier(ps: PolicyService): ChangeSupplier {
  return {
    module,
    subModule,
    fileExtension,
    listen(): Observable<ChangeLog> {
      return new Observable(observer => {
        const stream = ps._coll.watch([], {
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
}

export function policyApplier(
  ps: PolicyService,
  apikeyFinalizer: changeFactory,
  identityFinalizer: changeFactory
): ChangeApplier {
  return {
    module,
    subModule,
    fileExtension,
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const operationType = change.type;
        const policy: Policy = YAML.parse(change.resource_content);

        switch (operationType) {
          case ChangeType.CREATE:
            await CRUD.insert(ps, policy);
            return {status: SyncStatuses.SUCCEEDED};

          case ChangeType.UPDATE:
            await CRUD.replace(ps, policy);
            return {status: SyncStatuses.SUCCEEDED};

          case ChangeType.DELETE:
            await CRUD.remove(
              ps,
              new ObjectId(change.resource_id),
              apikeyFinalizer,
              identityFinalizer
            );
            return {status: SyncStatuses.SUCCEEDED};

          default:
            console.warn("Unknown operation type:", operationType);
            return {
              status: SyncStatuses.FAILED,
              reason: `Unknown operation type: ${operationType}`
            };
        }
      } catch (error) {
        console.warn("Error applying policy change:", error);
        return {status: SyncStatuses.FAILED, reason: error.message};
      }
    }
  };
}
