import {Resource, registrar} from "@spica-server/asset";
import {HistoryService} from "@spica-server/bucket/history";
import {Bucket, BucketDataService, BucketService} from "@spica-server/bucket/services";
import {Schema, Validator} from "@spica-server/core/schema";
import * as CRUD from "./crud";

const _module = "bucket";

export function registerAssetHandlers(
  bs: BucketService,
  bds: BucketDataService,
  history: HistoryService,
  schemaValidator: Validator
) {
  const validator = (resource: Resource<BucketAsset>) => {
    const bucket = resource.contents.schema;
    return validateBucket(bucket._id.toString(), bucket, schemaValidator);
  };

  registrar.validator(_module, validator);

  const operator = {
    insert: (resource: Resource<BucketAsset>) => CRUD.insert(bs, resource.contents.schema),

    update: (resource: Resource<BucketAsset>) =>
      CRUD.replace(bs, bds, history, resource.contents.schema),

    delete: (resource: Resource<BucketAsset>) => CRUD.remove(bs, bds, history, resource._id)
  };

  registrar.operator(_module, operator);
}

function validateBucket(schemaId: string, bucket: any, validator: Validator): Promise<void> {
  const validatorMixin = Schema.validate(schemaId);
  const pipe: any = new validatorMixin(validator);
  return pipe.transform(bucket);
}

export interface BucketAsset {
  schema: Bucket;
}
