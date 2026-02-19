import {DashboardService} from "../../dashboard.service";
import * as CRUD from "../../crud";
import {Dashboard} from "@spica-server/interface/dashboard";
import YAML from "yaml";
import {
  ChangeLog,
  ApplyResult,
  ChangeType,
  SyncStatuses,
  DocumentChangeApplier
} from "@spica-server/interface/versioncontrol";

const module = "dashboard";
const subModule = "schema";
const fileExtension = "yaml";

export const getApplier = (ds: DashboardService): DocumentChangeApplier => {
  const findDashboardByName = async (name: string) => {
    const dashboard = await ds.findOne({name});
    return dashboard?._id?.toString();
  };

  return {
    module,
    subModule,
    fileExtensions: [fileExtension],
    findIdBySlug: (slug: string): Promise<string> => {
      return findDashboardByName(slug);
    },
    findIdByContent: (content: string): Promise<string> => {
      let dashboard: Dashboard;

      try {
        dashboard = YAML.parse(content);
      } catch (error) {
        console.error("YAML parsing error:", error);
        return Promise.resolve(null);
      }

      return findDashboardByName(dashboard.name);
    },
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const type = change.type;
        const dashboard: Dashboard = YAML.parse(change.resource_content);
        switch (type) {
          case ChangeType.CREATE:
            await CRUD.insert(ds, dashboard);
            return {status: SyncStatuses.SUCCEEDED};

          case ChangeType.UPDATE:
            await CRUD.replace(ds, dashboard);
            return {status: SyncStatuses.SUCCEEDED};

          case ChangeType.DELETE:
            await CRUD.remove(ds, change.resource_id);
            return {status: SyncStatuses.SUCCEEDED};

          default:
            return {
              status: SyncStatuses.FAILED,
              reason: `Unknown operation type: ${type}`
            };
        }
      } catch (error: any) {
        console.warn("Error applying dashboard change:", error);
        return {status: SyncStatuses.FAILED, reason: error.message};
      }
    }
  };
};
