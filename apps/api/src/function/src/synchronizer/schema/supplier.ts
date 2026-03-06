import {Observable} from "rxjs";
import {FunctionService} from "@spica-server/function/services";
import YAML from "yaml";
import {
  ChangeLog,
  ChangeType,
  ChangeOrigin,
  DocumentChangeSupplier,
  ChangeInitiator
} from "@spica-server/interface/versioncontrol";
import {Function} from "@spica-server/interface/function";
import {Logger} from "@nestjs/common";

const logger = new Logger("FunctionSyncSupplier");

const module = "function";
const subModule = "schema";
const fileExtension = "yaml";

const getChangeForSchema = (
  fn: Function,
  type: ChangeType,
  initiator: ChangeInitiator,
  changeEventId: string
): ChangeLog => {
  return {
    module,
    sub_module: subModule,
    origin: ChangeOrigin.DOCUMENT,
    type,
    resource_id: fn._id.toString(),
    resource_slug: fn.name,
    resource_content: YAML.stringify(fn),
    resource_extension: fileExtension,
    created_at: new Date(),
    initiator,
    change_event_id: changeEventId
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
              const changeLog = getChangeForSchema(
                fn,
                ChangeType.CREATE,
                ChangeInitiator.INTERNAL,
                fn._id.toString()
              );
              observer.next(changeLog);
            });
          })
          .catch(error => {
            logger.error(
              "Error propagating existing functions:",
              error instanceof Error ? error.stack : String(error)
            );
          });

        const subs = fs
          .watch([], {
            fullDocument: "updateLookup",
            fullDocumentBeforeChange: "required"
          })
          .subscribe({
            next: change => {
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
                  logger.warn(`Unknown operation type: ${change.operationType}`);
                  return;
              }

              const changeLog = getChangeForSchema(
                documentData,
                changeType,
                ChangeInitiator.EXTERNAL,
                JSON.stringify(change._id)
              );
              observer.next(changeLog);
            },
            error: err => {
              observer.error(err);
            }
          });

        return () => {
          subs.unsubscribe();
        };
      });
    }
  };
};
