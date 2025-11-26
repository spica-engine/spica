import {Observable} from "rxjs";
import {EnvVarService} from "@spica-server/env_var/services";
import YAML from "yaml";
import {
  ChangeLog,
  ChangeType,
  ChangeOrigin,
  DocumentChangeSupplier
} from "@spica-server/interface/versioncontrol";
import {EnvVar} from "@spica-server/interface/env_var";

const module = "env-var";
const subModule = "schema";
const fileExtension = "yaml";

const getChangeLogForSchema = (envVar: EnvVar, type: ChangeType): ChangeLog => {
  return {
    module,
    sub_module: subModule,
    origin: ChangeOrigin.DOCUMENT,
    type: type,
    resource_id: envVar._id.toString(),
    resource_slug: envVar.key,
    resource_content: YAML.stringify(envVar),
    resource_extension: fileExtension,
    created_at: new Date()
  };
};

export const getSupplier = (evs: EnvVarService): DocumentChangeSupplier => {
  return {
    module,
    subModule,
    listen(): Observable<ChangeLog> {
      return new Observable(observer => {
        evs._coll
          .find()
          .toArray()
          .then(envVars => {
            envVars.forEach(envVar => {
              const changeLog = getChangeLogForSchema(envVar, ChangeType.CREATE);
              observer.next(changeLog);
            });
          })
          .catch(error => {
            console.error("Error propagating existing buckets:", error);
          });

        const stream = evs._coll.watch([], {
          fullDocument: "updateLookup",
          fullDocumentBeforeChange: "required"
        });

        stream.on("change", change => {
          let changeType: ChangeType;
          let documentData: EnvVar | undefined;
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

          const changeLog = getChangeLogForSchema(documentData, changeType);
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
