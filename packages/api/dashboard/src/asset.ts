import {Validator, Schema} from "@spica-server/core-schema";
import {IRepresentativeManager} from "@spica-server/interface-representative";
import {Resource} from "@spica-server/interface-asset";
import {registrar} from "@spica-server/asset";
import {DashboardAsset, DashboardRepository} from "@spica-server/interface-dashboard";
import {ids, idOf, stripId, assignId, withId} from "@spica-server/data";

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
      assignId(
        dashboard,
        idOf(dashboard) == null ? dashboardIds().generate() : dashboardIds().parse(idOf(dashboard))
      );

      return dashboards.insert(dashboard);
    },

    update: (resource: Resource<DashboardAsset>) => {
      const dashboard = resource.contents.schema;
      const id = dashboardIds().parse(idOf(dashboard));
      stripId(dashboard);
      return dashboards.replaceById(id, dashboard);
    },

    delete: (resource: Resource<DashboardAsset>) =>
      dashboards.deleteById(dashboardIds().parse(idOf(resource)))
  };
  registrar.operator(_module, operator);

  const exporter = async (id: string) => {
    if (!dashboardIds().isValid(id)) {
      return Promise.reject(`${id} is not a valid object id`);
    }
    const dashboard = await dashboards.findById(dashboardIds().parse(id));

    if (!dashboard) {
      return Promise.reject(`Dashboard does not exist with id ${id}`);
    }
    return assetRepManager.write(_module, id, "schema", dashboard, "yaml");
  };
  registrar.exporter(_module, exporter);

  const lister = () =>
    dashboards.findAll().then(all => {
      return all.map(d => {
        return withId({title: d.name}, idOf(d).toString());
      });
    });
}

function validateDashboard(dashboard: any, validator: Validator): Promise<void> {
  const validatorMixin = Schema.validate("http://spica.internal/dashboard");

  const pipe: any = new validatorMixin(validator);
  return pipe.transform(dashboard);
}
