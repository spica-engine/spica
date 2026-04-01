import {Observable} from "rxjs";
import {DashboardService} from "../../dashboard.service.js";
import YAML from "yaml";
import {
  ChangeLog,
  ChangeType,
  ChangeOrigin,
  DocumentChangeSupplier,
  ChangeInitiator
} from "@spica-server/interface/versioncontrol";
import {Dashboard} from "@spica-server/interface/dashboard";
import {Logger} from "@nestjs/common";

const logger = new Logger("DashboardSyncSupplier");

const module = "dashboard";
const subModule = "schema";
const fileExtension = "yaml";

const getChangeLogForSchema = (
  dashboard: Dashboard,
  type: ChangeType,
  initiator: ChangeInitiator,
  eventId: string
): ChangeLog => {
  return {
    module,
    sub_module: subModule,
    origin: ChangeOrigin.DOCUMENT,
    type: type,
    resource_id: dashboard._id.toString(),
    resource_slug: dashboard.name,
    resource_content: YAML.stringify(dashboard),
    resource_extension: fileExtension,
    created_at: new Date(),
    initiator,
    event_id: eventId
  };
};

export const getSupplier = (ds: DashboardService): DocumentChangeSupplier => {
  return {
    module,
    subModule,
    listen(): Observable<ChangeLog> {
      return new Observable(observer => {
        ds._coll
          .find()
          .toArray()
          .then(dashboards => {
            dashboards.forEach(dashboard => {
              const changeLog = getChangeLogForSchema(
                dashboard,
                ChangeType.CREATE,
                ChangeInitiator.INTERNAL,
                dashboard._id.toString()
              );
              observer.next(changeLog);
            });
          })
          .catch(error => {
            logger.error(
              "Error propagating existing dashboards:",
              error instanceof Error ? error.stack : String(error)
            );
          });

        const subs = ds
          .watch([], {
            fullDocument: "updateLookup",
            fullDocumentBeforeChange: "required"
          })
          .subscribe({
            next: change => {
              let changeType: ChangeType;
              let documentData: Dashboard | undefined;
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
