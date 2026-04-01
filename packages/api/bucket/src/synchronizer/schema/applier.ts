import {BucketDataService, BucketService} from "@spica-server/bucket/services";
import {HistoryService} from "@spica-server/bucket/history";
import * as CRUD from "../../crud";
import {Bucket} from "@spica-server/interface/bucket";
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
  const findIdByTitle = async (title: string) => {
    const bucket = await bs.findOne({title});
    return bucket?._id?.toString();
  };
  return {
    module,
    subModule,
    fileExtensions: [fileExtension],
    extractId: async (slug: string, content?: string): Promise<string | null> => {
      const id = await findIdByTitle(slug);
      if (id) return id;

      if (content) {
        let bucket: Bucket;
        try {
          bucket = YAML.parse(content);
        } catch (error) {
          logger.error("YAML parsing error:", error instanceof Error ? error.stack : String(error));
          return null;
        }
        return bucket?._id ? String(bucket._id) : null;
      }

      return null;
    },
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const operationType = change.type;

        const overwritePrimaries = (change: ChangeLog, bucket) => {
          if (change.resource_id) {
            bucket._id = change.resource_id;
          }

          if (change.resource_slug) {
            bucket.title = change.resource_slug;
          }
        };

        switch (operationType) {
          case ChangeType.CREATE: {
            const bucket = YAML.parse(change.resource_content);
            overwritePrimaries(change, bucket);
            await validate(bucket, validator);
            await CRUD.insert(bs, bucket);
            return {status: SyncStatuses.SUCCEEDED};
          }

          case ChangeType.UPDATE: {
            const bucket = YAML.parse(change.resource_content);
            overwritePrimaries(change, bucket);
            await validate(bucket, validator);
            await CRUD.replace(bs, bds, history, bucket);
            return {status: SyncStatuses.SUCCEEDED};
          }

          case ChangeType.DELETE:
            await CRUD.remove(bs, bds, history, change.resource_id);
            return {status: SyncStatuses.SUCCEEDED};

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
