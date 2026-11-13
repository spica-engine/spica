import {registrar} from "@spica-server/asset";
import {Resource} from "@spica-server/interface-asset";
import {HistoryRepository} from "@spica-server/interface-bucket-history";
import {BucketService, bucketIds} from "@spica-server/bucket-services";
import {Schema, Validator} from "@spica-server/core-schema";
import * as CRUD from "./crud.js";
import {IRepresentativeManager} from "@spica-server/interface-representative";
import {
  BucketAsset,
  BucketDataRepository,
  BucketRuleValidator
} from "@spica-server/interface-bucket";
import {idOf} from "@spica-server/data";

const _module = "bucket";

export function registerAssetHandlers(
  bs: BucketService,
  bucketData: BucketDataRepository,
  history: HistoryRepository,
  rules: BucketRuleValidator,
  schemaValidator: Validator,
  assetRepManager: IRepresentativeManager
) {
  const validator = async (resource: Resource<BucketAsset>) => {
    const bucket = resource.contents.schema;
    await validateBucket(bucket, schemaValidator);
  };

  registrar.validator(_module, validator);

  const operator = {
    insert: (resource: Resource<BucketAsset>) => CRUD.insert(bs, rules, resource.contents.schema),

    update: (resource: Resource<BucketAsset>) =>
      CRUD.replace(bs, bucketData, history, rules, resource.contents.schema),

    delete: (resource: Resource<BucketAsset>) =>
      CRUD.remove(bs, bucketData, history, idOf(resource))
  };

  registrar.operator(_module, operator);

  const exporter = async (id: string) => {
    if (!bucketIds().isValid(id)) {
      return Promise.reject(`${id} is not a valid object id`);
    }
    const bucket = await bs.findById(bucketIds().parse(id));

    if (!bucket) {
      return Promise.reject(`Bucket does not exist with id ${id}`);
    }
    return assetRepManager.write(_module, id, "schema", bucket, "yaml");
  };

  registrar.exporter(_module, exporter);
}

function validateBucket(bucket: any, validator: Validator): Promise<void> {
  const validatorMixin = Schema.validate("http://spica.internal/bucket/schema");

  const pipe: any = new validatorMixin(validator);
  return pipe.transform(bucket);
}
