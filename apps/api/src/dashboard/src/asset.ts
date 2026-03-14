import {Validator, Schema} from "@spica-server/core/schema";
import {DashboardService} from "@spica-server/dashboard";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {Resource} from "@spica-server/interface/asset";
import {registrar} from "@spica-server/asset";
import {ObjectId, ReturnDocument} from "@spica-server/database";
import {DashboardAsset} from "@spica-server/interface/dashboard";

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
        returnDocument: ReturnDocument.AFTER
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

function validateDashboard(dashboard: any, validator: Validator): Promise<void> {
  const validatorMixin = Schema.validate("http://spica.internal/dashboard");

  const pipe: any = new validatorMixin(validator);
  return pipe.transform(dashboard);
}
