import {Validator, Schema} from "@spica-server/core-schema";
import {IRepresentativeManager} from "@spica-server/interface-representative";
import {Resource} from "@spica-server/interface-asset";
import {registrar} from "@spica-server/asset";
import {DashboardAsset, DashboardRepository} from "@spica-server/interface-dashboard";
import {ids} from "@spica-server/data";

const dashboardIds = () => ids().forCollection("dashboard");

const _module = "dashboard";

export function registerAssetHandlers(
  dashboards: DashboardRepository,
  schemaValidator: Validator,
  assetRepManager: IRepresentativeManager
) {
  const validator = (resource: Resource<DashboardAsset>) => {
    const dashboard = resource.contents.schema;
    return validateDashboard(dashboard, schemaValidator);
  };
  registrar.validator(_module, validator);

  const operator = {
    insert: (resource: Resource<DashboardAsset>) => {
      const dashboard = resource.contents.schema;
      dashboard._id =
        dashboard._id == null ? dashboardIds().generate() : dashboardIds().parse(dashboard._id);

      return dashboards.insert(dashboard);
    },

    update: (resource: Resource<DashboardAsset>) => {
      const dashboard = resource.contents.schema;
      const _id = dashboardIds().parse(dashboard._id);
      delete dashboard._id;
      return dashboards.replaceById(_id, dashboard);
    },

    delete: (resource: Resource<DashboardAsset>) =>
      dashboards.deleteById(dashboardIds().parse(resource._id))
  };
  registrar.operator(_module, operator);

  const exporter = async (_id: string) => {
    if (!dashboardIds().isValid(_id)) {
      return Promise.reject(`${_id} is not a valid object id`);
    }
    const dashboard = await dashboards.findById(dashboardIds().parse(_id));

    if (!dashboard) {
      return Promise.reject(`Dashboard does not exist with _id ${_id}`);
    }
    return assetRepManager.write(_module, _id, "schema", dashboard, "yaml");
  };
  registrar.exporter(_module, exporter);

  const lister = () =>
    dashboards.findAll().then(all => {
      return all.map(d => {
        return {
          _id: d._id.toString(),
          title: d.name
        };
      });
    });
}

function validateDashboard(dashboard: any, validator: Validator): Promise<void> {
  const validatorMixin = Schema.validate("http://spica.internal/dashboard");

  const pipe: any = new validatorMixin(validator);
  return pipe.transform(dashboard);
}
