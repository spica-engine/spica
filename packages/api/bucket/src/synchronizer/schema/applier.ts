import {BucketDataService, BucketService} from "@spica-server/bucket-services";
import {HistoryService} from "@spica-server/bucket-history";
import * as CRUD from "../../crud.js";
import {Bucket} from "@spica-server/interface-bucket";
import YAML from "yaml";
import {
  ChangeLog,
  ApplyResult,
  ChangeType,
  SyncStatuses,
  DocumentChangeApplier
} from "@spica-server/interface-versioncontrol";
import {Schema, Validator} from "@spica-server/core-schema";
import {Logger} from "@nestjs/common";

const logger = new Logger("BucketSyncApplier");

const module = "bucket";
const subModule = "schema";
const fileExtension = "yaml";

function validate(bucket: Bucket, validator: Validator): Promise<void> {
  const validatorMixin = Schema.validate("http://spica.internal/bucket/schema");
  const pipe: any = new validatorMixin(validator);
  return pipe.transform(bucket);
}

export const getApplier = (
  bs: BucketService,
  bds: BucketDataService,
  history: HistoryService,
  validator: Validator
): DocumentChangeApplier => {
  return {
    module,
    subModule,
    fileExtensions: [fileExtension],
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const operationType = change.type;

        const overwriteSlug = bucket => {
          if (change.resource_slug) {
            bucket.title = change.resource_slug;
          }
        };

        switch (operationType) {
          case ChangeType.CREATE: {
            const bucket = YAML.parse(change.resource_content);
            overwriteSlug(bucket);
            await validate(bucket, validator);
            await CRUD.insert(bs, bucket);
            return {status: SyncStatuses.SUCCEEDED};
          }

          case ChangeType.UPDATE: {
            const bucket = YAML.parse(change.resource_content);
            const existing = await bs.findOne({title: change.resource_slug});
            if (existing) {
              bucket._id = existing._id.toString();
            }
            overwriteSlug(bucket);
            await validate(bucket, validator);
            await CRUD.replace(bs, bds, history, bucket);
            return {status: SyncStatuses.SUCCEEDED};
          }

          case ChangeType.DELETE: {
            const existing = await bs.findOne({title: change.resource_slug});
            if (!existing) {
              return {status: SyncStatuses.FAILED, reason: "Bucket not found"};
            }
            await CRUD.remove(bs, bds, history, existing._id.toString());
            return {status: SyncStatuses.SUCCEEDED};
          }

          default:
            logger.warn(`Unknown operation type: ${operationType}`);
            return {
              status: SyncStatuses.FAILED,
              reason: `Unknown operation type: ${operationType}`
            };
        }
      } catch (error) {
        logger.warn(`Error applying bucket change: ${(error as any).stack || String(error)}`);
        return {status: SyncStatuses.FAILED, reason: error.message};
      }
    }
  };
};
