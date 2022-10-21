import {Resource, register} from "@spica-server/asset";
import {HistoryService} from "@spica-server/bucket/history";
import {Bucket, BucketDataService, BucketService} from "@spica-server/bucket/services";
import {Schema, Validator} from "@spica-server/core/schema";
import {ObjectId} from "@spica-server/database";
import {clearRelationsOnDrop, updateDocumentsOnChange} from "./changes";

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

  register.validator(_module, validator);

  const operator = {
    insert: async (resource: Resource<BucketAsset>) => {
      const bucket = resource.contents.schema;

      await bs.insertOne({...bucket, _id: new ObjectId(bucket._id)});
      bs.emitSchemaChanges();
      return resource;
    },

    update: async (resource: Resource<BucketAsset>) => {
      const bucket = resource.contents.schema;

      const _id = new ObjectId(bucket._id);
      delete bucket._id;

      const previousSchema = await bs.findOne({_id});

      const currentSchema = await bs.findOneAndReplace({_id}, bucket, {
        returnOriginal: false
      });

      await updateDocumentsOnChange(bds, previousSchema, currentSchema);

      bs.emitSchemaChanges();

      if (history) {
        await history.updateHistories(previousSchema, currentSchema);
      }

      return currentSchema;
    },

    delete: async (resource: Resource<BucketAsset>) => {
      const bucket = resource.contents.schema;

      const schema = await bs.drop(bucket._id);
      if (schema) {
        const promises = [];

        promises.push(clearRelationsOnDrop(bs, bds, schema._id));
        if (history) {
          promises.push(history.deleteMany({bucket_id: schema._id}));
        }

        await Promise.all(promises);

        bs.emitSchemaChanges();
      }
    }
  };

  register.operator(_module, operator);
}

function validateBucket(schemaId: string, bucket: any, validator: Validator): Promise<void> {
  const validatorMixin = Schema.validate(schemaId);
  const pipe: any = new validatorMixin(validator);
  return pipe.transform(bucket);
}

export interface BucketAsset {
  schema: Bucket;
}
