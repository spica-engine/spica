import {PolicyService} from "@spica-server/passport/policy";
import {changeFactory, Policy} from "@spica-server/interface/passport/policy";
import YAML from "yaml";
import * as CRUD from "../../../src/crud";
import {
  ChangeLog,
  ApplyResult,
  ChangeType,
  SyncStatuses,
  DocumentChangeApplier
} from "@spica-server/interface/versioncontrol";
import {ObjectId} from "bson";
import {Logger} from "@nestjs/common";
import {Schema, Validator} from "@spica-server/core/schema";

const logger = new Logger("PolicySyncApplier");

const module = "policy";
const subModule = "schema";
const fileExtension = "yaml";

function validate(policy: Policy, validator: Validator): Promise<void> {
  const validatorMixin = Schema.validate("http://spica.internal/passport/policy");
  const pipe: any = new validatorMixin(validator);
  return pipe.transform(policy);
}

export function getApplier(
  ps: PolicyService,
  apikeyFinalizer: changeFactory,
  identityFinalizer: changeFactory,
  validator: Validator
): DocumentChangeApplier {
  const findIdByName = async (name: string) => {
    const policy = await ps.findOne({name});
    return policy?._id?.toString();
  };
  return {
    module,
    subModule,
    fileExtensions: [fileExtension],
    extractId: async (content: string, slug?: string): Promise<string | null> => {
      if (slug) {
        const id = await findIdByName(slug);
        if (id) return id;
      }

      let policy: Policy;
      try {
        policy = YAML.parse(content);
      } catch (error) {
        logger.error("YAML parsing error:", error instanceof Error ? error.stack : String(error));
        return null;
      }

      const idFromSlug = await findIdByName(policy?.name);
      if (idFromSlug) return idFromSlug;

      return policy?._id ? String(policy._id) : null;
    },
    apply: async (change: ChangeLog): Promise<ApplyResult> => {
      try {
        const operationType = change.type;

        const overwritePrimaries = (change: ChangeLog, policy) => {
          if (change.resource_id) {
            policy._id = change.resource_id;
          }

          if (change.resource_slug) {
            policy.name = change.resource_slug;
          }
        };

        switch (operationType) {
          case ChangeType.CREATE: {
            const policy: Policy = YAML.parse(change.resource_content);
            overwritePrimaries(change, policy);
            await validate(policy, validator);
            await CRUD.insert(ps, policy);
            return {status: SyncStatuses.SUCCEEDED};
          }

          case ChangeType.UPDATE: {
            const policy: Policy = YAML.parse(change.resource_content);
            overwritePrimaries(change, policy);
            await validate(policy, validator);
            await CRUD.replace(ps, policy);
            return {status: SyncStatuses.SUCCEEDED};
          }

          case ChangeType.DELETE:
            await CRUD.remove(
              ps,
              ObjectId.createFromHexString(change.resource_id),
              apikeyFinalizer,
              identityFinalizer
            );
            return {status: SyncStatuses.SUCCEEDED};

          default:
            logger.warn(`Unknown operation type: ${operationType}`);
            return {
              status: SyncStatuses.FAILED,
              reason: `Unknown operation type: ${operationType}`
            };
        }
      } catch (error) {
        logger.warn(`Error applying policy change: ${(error as any).stack || String(error)}`);
        return {status: SyncStatuses.FAILED, reason: error.message};
      }
    }
  };
}
