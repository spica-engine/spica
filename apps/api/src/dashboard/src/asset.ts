import {Validator, Schema} from "@spica-server/core/schema";
import {Dashboard, DashboardService} from "@spica-server/dashboard";
import {IRepresentativeManager} from "@spica/interface";
import {Resource} from "@spica/interface";
import {registrar} from "@spica-server/asset";
import {ObjectId} from "@spica-server/database";

const _module = "dashboard";

export function registerAssetHandlers(
  ds: DashboardService,
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
      dashboard._id = new ObjectId(dashboard._id);

      return ds.insertOne(dashboard);
    },

    update: (resource: Resource<DashboardAsset>) => {
      const dashboard = resource.contents.schema;
      const _id = new ObjectId(dashboard._id);
      delete dashboard._id;
      return ds.findOneAndReplace({_id}, dashboard, {
        returnOriginal: false
      });
    },

    delete: (resource: Resource<DashboardAsset>) => ds.deleteOne({_id: new ObjectId(resource._id)})
  };
  registrar.operator(_module, operator);

  const exporter = async (_id: string) => {
    if (!ObjectId.isValid(_id)) {
      return Promise.reject(`${_id} is not a valid object id`);
    }
    const dashboard = await ds.findOne({_id: new ObjectId(_id)});

    if (!dashboard) {
      return Promise.reject(`Dashboard does not exist with _id ${_id}`);
    }
    return assetRepManager.write(_module, _id, "schema", dashboard, "yaml");
  };
  registrar.exporter(_module, exporter);

  const lister = () =>
    ds.find().then(dashboards => {
      return dashboards.map(d => {
        return {
          _id: d._id.toHexString(),
          title: d.name
        };
      });
    });
}

export interface DashboardAsset {
  schema: Dashboard;
}

function validateDashboard(dashboard: any, validator: Validator): Promise<void> {
  const validatorMixin = Schema.validate("http://spica.internal/dashboard");

  const pipe: any = new validatorMixin(validator);
  return pipe.transform(dashboard);
}
