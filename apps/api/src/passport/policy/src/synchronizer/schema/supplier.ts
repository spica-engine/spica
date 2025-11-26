import {Observable} from "rxjs";
import {PolicyService} from "@spica-server/passport/policy";
import YAML from "yaml";
import {
  ChangeLog,
  ChangeType,
  ChangeOrigin,
  DocumentChangeSupplier
} from "@spica-server/interface/versioncontrol";
import {Policy} from "@spica-server/interface/passport/policy";

const module = "policy";
const subModule = "schema";
const fileExtension = "yaml";

const getChangeForSchema = (policy: Policy, changeType: ChangeType): ChangeLog => {
  return {
    module,
    sub_module: subModule,
    origin: ChangeOrigin.DOCUMENT,
    type: changeType,
    resource_id: policy._id.toString(),
    resource_slug: policy.name,
    resource_content: YAML.stringify(policy),
    resource_extension: fileExtension,
    created_at: new Date()
  };
};

export function getSupplier(ps: PolicyService): DocumentChangeSupplier {
  return {
    module,
    subModule,
    listen(): Observable<ChangeLog> {
      return new Observable(observer => {
        ps._coll
          .find()
          .toArray()
          .then(policies => {
            policies.forEach(policy => {
              const changeLog = getChangeForSchema(policy, ChangeType.CREATE);
              observer.next(changeLog);
            });
          })
          .catch(error => {
            console.error("Error propagating existing policies:", error);
          });
        const stream = ps._coll.watch([], {
          fullDocument: "updateLookup",
          fullDocumentBeforeChange: "required"
        });

        stream.on("change", change => {
          let changeType: ChangeType;
          let documentData: Policy | undefined;
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
              console.warn("Unknown operation type:", change.operationType);
              break;
          }
          if (Object.values(ChangeType).includes(changeType)) {
            const changeLog = getChangeForSchema(documentData, changeType);
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
