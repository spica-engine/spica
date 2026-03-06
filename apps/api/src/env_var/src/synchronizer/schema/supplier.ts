import {Observable} from "rxjs";
import {EnvVarService} from "@spica-server/env_var/services";
import YAML from "yaml";
import {
  ChangeLog,
  ChangeType,
  ChangeOrigin,
  DocumentChangeSupplier,
  ChangeInitiator
} from "@spica-server/interface/versioncontrol";
import {EnvVar} from "@spica-server/interface/env_var";
import {Logger} from "@nestjs/common";

const logger = new Logger("EnvVarSyncSupplier");

const module = "env-var";
const subModule = "schema";
const fileExtension = "yaml";

const getChangeLogForSchema = (
  envVar: EnvVar,
  type: ChangeType,
  initiator: ChangeInitiator,
  changeEventId: string
): ChangeLog => {
  return {
    module,
    sub_module: subModule,
    origin: ChangeOrigin.DOCUMENT,
    type: type,
    resource_id: envVar._id.toString(),
    resource_slug: envVar.key,
    resource_content: YAML.stringify(envVar),
    resource_extension: fileExtension,
    created_at: new Date(),
    initiator,
    change_event_id: changeEventId
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
              const changeLog = getChangeLogForSchema(
                envVar,
                ChangeType.CREATE,
                ChangeInitiator.INTERNAL,
                envVar._id.toString()
              );
              observer.next(changeLog);
            });
          })
          .catch(error => {
            logger.error(
              "Error propagating existing environment variables:",
              error instanceof Error ? error.stack : String(error)
            );
          });

        const subs = evs
          .watch([], {
            fullDocument: "updateLookup",
            fullDocumentBeforeChange: "required"
          })
          .subscribe({
            next: change => {
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
                  logger.warn(`Unknown operation type: ${change.operationType}`);
                  return;
              }
              const changeLog = getChangeLogForSchema(
                documentData,
                changeType,
                ChangeInitiator.EXTERNAL,
                JSON.stringify(change._id)
              );
              observer.next(changeLog);
            },
            error: err => observer.error(err)
          });

        return () => {
          subs.unsubscribe();
        };
      });
    }
  };
};
