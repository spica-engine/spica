import {Observable} from "rxjs";
import {FunctionService} from "@spica-server/function/services";
import YAML from "yaml";
import {
  ChangeLog,
  ChangeType,
  ChangeOrigin,
  DocumentChangeSupplier
} from "@spica-server/interface/versioncontrol";
import {Function} from "@spica-server/interface/function";

const module = "function";
const subModule = "schema";
const fileExtension = "yaml";

const getChangeForSchema = (fn: Function, type: ChangeType): ChangeLog => {
  return {
    module,
    sub_module: subModule,
    origin: ChangeOrigin.DOCUMENT,
    type,
    resource_id: fn._id.toString(),
    resource_slug: fn.name,
    resource_content: YAML.stringify(fn),
    resource_extension: fileExtension,
    created_at: new Date()
  };
};

export const getSupplier = (fs: FunctionService): DocumentChangeSupplier => {
  return {
    module,
    subModule,
    listen(): Observable<ChangeLog> {
      return new Observable(observer => {
        fs._coll
          .find()
          .toArray()
          .then(functions => {
            functions.forEach(fn => {
              const changeLog = getChangeForSchema(fn, ChangeType.CREATE);
              observer.next(changeLog);
            });
          })
          .catch(error => {
            console.error("Error propagating existing functions:", error);
          });

        const stream = fs._coll.watch([], {
          fullDocument: "updateLookup",
          fullDocumentBeforeChange: "required"
        });

        stream.on("change", change => {
          let changeType: ChangeType;
          let documentData: Function | undefined;
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

          const changeLog = getChangeForSchema(documentData, changeType);
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
