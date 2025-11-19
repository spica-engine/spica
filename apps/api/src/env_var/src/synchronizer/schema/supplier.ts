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
              break;
          }

          if (changeType) {
            const changeLog = getChangeLogForSchema(change["fullDocument"], changeType);
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
