import {Observable} from "rxjs";
import {DashboardService} from "../../dashboard.service";
import YAML from "yaml";
import {
  ChangeLog,
  ChangeType,
  ChangeOrigin,
  DocumentChangeSupplier,
  ChangeInitiator
} from "@spica-server/interface/versioncontrol";
import {Dashboard} from "@spica-server/interface/dashboard";

const module = "dashboard";
const subModule = "schema";
const fileExtension = "yaml";

const getChangeLogForSchema = (
  dashboard: Dashboard,
  type: ChangeType,
  initiator: ChangeInitiator
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
    initiator
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
                ChangeInitiator.INTERNAL
              );
              observer.next(changeLog);
            });
          })
          .catch(error => {
            console.error("Error propagating existing dashboards:", error);
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
                  console.warn("Unknown operation type:", change.operationType);
                  return;
              }
              const changeLog = getChangeLogForSchema(
                documentData,
                changeType,
                ChangeInitiator.EXTERNAL
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
