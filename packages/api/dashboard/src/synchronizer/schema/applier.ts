import {DashboardService} from "../../dashboard.service.js";
import * as CRUD from "../../crud.js";
import {Dashboard} from "@spica-server/interface/dashboard";
import YAML from "yaml";
import {
  ChangeLog,
  ApplyResult,
  ChangeType,
  SyncStatuses,
  DocumentChangeApplier
} from "@spica-server/interface/versioncontrol";
import {Schema, Validator} from "@spica-server/core/schema";
import {Logger} from "@nestjs/common";

const logger = new Logger("DashboardSyncApplier");

const module = "dashboard";
const subModule = "schema";
const fileExtension = "yaml";

function validate(dashboard: Dashboard, validator: Validator): Promise<void> {
  const validatorMixin = Schema.validate("http://spica.internal/dashboard");
  const pipe: any = new validatorMixin(validator);
  return pipe.transform(dashboard);
}

export const getApplier = (ds: DashboardService, validator: Validator): DocumentChangeApplier => {
  const findIdByName = async (name: string) => {
    const dashboard = await ds.findOne({name});
    return dashboard?._id?.toString();
  };

  return {
    module,
    subModule,
    fileExtensions: [fileExtension],
    extractId: async (slug: string, content?: string): Promise<string | null> => {
      const id = await findIdByName(slug);
      if (id) return id;

      if (content) {
        let dashboard: Dashboard;
        try {
          dashboard = YAML.parse(content);
        } catch (error) {
          logger.error("YAML parsing error:", error instanceof Error ? error.stack : String(error));
          return null;
        }
        return dashboard?._id ? String(dashboard._id) : null;
      }

      return null;
    },
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const type = change.type;

        const overwritePrimaries = (change: ChangeLog, dashboard: any) => {
          if (change.resource_id) {
            dashboard._id = change.resource_id;
          }

          if (change.resource_slug) {
            dashboard.name = change.resource_slug;
          }
        };

        switch (type) {
          case ChangeType.CREATE: {
            const dashboard: Dashboard = YAML.parse(change.resource_content);
            overwritePrimaries(change, dashboard);
            await validate(dashboard, validator);
            await CRUD.insert(ds, dashboard);
            return {status: SyncStatuses.SUCCEEDED};
          }

          case ChangeType.UPDATE: {
            const dashboard: Dashboard = YAML.parse(change.resource_content);
            overwritePrimaries(change, dashboard);
            await validate(dashboard, validator);
            await CRUD.replace(ds, dashboard);
            return {status: SyncStatuses.SUCCEEDED};
          }

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
        logger.warn(`Error applying dashboard change: ${error.stack || String(error)}`);
        return {status: SyncStatuses.FAILED, reason: error.message};
      }
    }
  };
};
