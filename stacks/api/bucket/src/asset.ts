import {registrar} from "@spica-server/asset";
import {Resource} from "@spica-server/interface/asset";
import {HistoryService} from "@spica-server/bucket/history";
import {Bucket, BucketDataService, BucketService} from "@spica-server/bucket/services";
import {Schema, Validator} from "@spica-server/core/schema";
import * as CRUD from "./crud";
import {IRepresentativeManager} from "@spica-server/interface/representative";
import {ObjectId} from "@spica-server/database";

const _module = "bucket";

export function registerAssetHandlers(
  bs: BucketService,
  bds: BucketDataService,
  history: HistoryService,
  schemaValidator: Validator,
  assetRepManager: IRepresentativeManager
) {
  const validator = (resource: Resource<BucketAsset>) => {
    const bucket = resource.contents.schema;
    return validateBucket(bucket, schemaValidator);
  };

  registrar.validator(_module, validator);

  const operator = {
    insert: (resource: Resource<BucketAsset>) => CRUD.insert(bs, resource.contents.schema),

    update: (resource: Resource<BucketAsset>) =>
      CRUD.replace(bs, bds, history, resource.contents.schema),

    delete: (resource: Resource<BucketAsset>) => CRUD.remove(bs, bds, history, resource._id)
  };

  registrar.operator(_module, operator);

  const exporter = async (_id: string) => {
    if (!ObjectId.isValid(_id)) {
      return Promise.reject(`${_id} is not a valid object id`);
    }
    const bucket = await bs.findOne({_id: new ObjectId(_id)});

    if (!bucket) {
      return Promise.reject(`Bucket does not exist with _id ${_id}`);
    }
    return assetRepManager.write(_module, _id, "schema", bucket, "yaml");
  };

  registrar.exporter(_module, exporter);
}

function validateBucket(bucket: any, validator: Validator): Promise<void> {
  const validatorMixin = Schema.validate("http://spica.internal/bucket/schema");

  const pipe: any = new validatorMixin(validator);
  return pipe.transform(bucket);
}

export interface BucketAsset {
  schema: Bucket;
}
