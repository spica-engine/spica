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

const module = "bucket";
const subModule = "schema";
const fileExtension = "yaml";

export const getApplier = (
  bs: BucketService,
  bds: BucketDataService,
  history: HistoryService
): DocumentChangeApplier => {
  const findBucketByTitle = async (title: string) => {
    const bucket = await bs.findOne({title});
    return bucket?._id?.toString();
  };
  return {
    module,
    subModule,
    fileExtensions: [fileExtension],
    findIdBySlug: (slug: string): Promise<string> => {
      return findBucketByTitle(slug);
    },
    findIdByContent: (content: string): Promise<string> => {
      let bucket: Bucket;

      try {
        bucket = YAML.parse(content);
        return findBucketByTitle(bucket?.title);
      } catch (error) {
        console.error("YAML parsing error:", error);
        return Promise.resolve(null);
      }
    },
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const operationType = change.type;
        const bucket = YAML.parse(change.resource_content);

        const fillPrimaryFields = (change: ChangeLog, bucket) => {
          if (change.resource_id) {
            bucket._id = change.resource_id;
          }

          if (change.resource_slug) {
            bucket.title = change.resource_slug;
          }
        };

        fillPrimaryFields(change, bucket);

        switch (operationType) {
          case ChangeType.CREATE:
          case ChangeType.UPDATE:
            await CRUD.upsert(bs, bds, history, bucket);
            return {status: SyncStatuses.SUCCEEDED};

          case ChangeType.DELETE:
            await CRUD.remove(bs, bds, history, change.resource_id);
            return {status: SyncStatuses.SUCCEEDED};

          default:
            console.warn("Unknown operation type:", operationType);
            return {
              status: SyncStatuses.FAILED,
              reason: `Unknown operation type: ${operationType}`
            };
        }
      } catch (error) {
        console.warn("Error applying bucket change:", error);
        return {status: SyncStatuses.FAILED, reason: error.message};
      }
    }
  };
};
