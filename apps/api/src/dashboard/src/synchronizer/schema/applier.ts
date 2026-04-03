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
  return {
    module,
    subModule,
    fileExtensions: [fileExtension],
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const type = change.type;

        const overwriteSlug = (dashboard: any) => {
          if (change.resource_slug) {
            dashboard.name = change.resource_slug;
          }
        };

        switch (type) {
          case ChangeType.CREATE: {
            const dashboard: Dashboard = YAML.parse(change.resource_content);
            overwriteSlug(dashboard);
            await validate(dashboard, validator);
            await CRUD.insert(ds, dashboard);
            return {status: SyncStatuses.SUCCEEDED};
          }

          case ChangeType.UPDATE: {
            const dashboard: Dashboard = YAML.parse(change.resource_content);
            const existing = await ds.findOne({name: change.resource_slug});
            if (existing) {
              dashboard._id = existing._id;
            }
            overwriteSlug(dashboard);
            await validate(dashboard, validator);
            await CRUD.replace(ds, dashboard);
            return {status: SyncStatuses.SUCCEEDED};
          }

          case ChangeType.DELETE: {
            const existing = await ds.findOne({name: change.resource_slug});
            if (!existing) {
              return {status: SyncStatuses.FAILED, reason: "Dashboard not found"};
            }
            await CRUD.remove(ds, existing._id);
            return {status: SyncStatuses.SUCCEEDED};
          }

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
