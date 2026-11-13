import {RepositoryClass, RepositoryClasses} from "@spica-server/interface-data";
import {REFRESH_TOKEN_REPOSITORY} from "@spica-server/interface-passport-refresh_token";
import {MongoRefreshTokenRepository} from "./passport/refresh-token.js";
import {APIKEY_REPOSITORY} from "@spica-server/interface-passport-apikey";
import {MongoApiKeyRepository} from "./passport/apikey.js";
import {STRATEGY_REPOSITORY} from "@spica-server/interface-passport";
import {MongoStrategyRepository} from "./passport/strategy.js";
import {POLICY_REPOSITORY} from "@spica-server/interface-passport-policy";
import {MongoPolicyRepository} from "./passport/policy.js";
import {IDENTITY_REPOSITORY} from "@spica-server/interface-passport-identity";
import {MongoIdentityRepository} from "./passport/identity.js";
import {USER_REPOSITORY, VERIFICATION_REPOSITORY} from "@spica-server/interface-passport-user";
import {MongoUserRepository, MongoVerificationRepository} from "./passport/user.js";
import {FUNCTION_REPOSITORY} from "@spica-server/interface-function";
import {FUNCTION_LOG_REPOSITORY, FUNCTION_LOG_SINK} from "@spica-server/interface-function-log";
import {WEBHOOK_LOG_REPOSITORY, WEBHOOK_REPOSITORY} from "@spica-server/interface-function-webhook";
import {MongoFunctionRepository} from "./function/function.js";
import {MongoFunctionLogRepository, MongoFunctionLogSink} from "./function/log.js";
import {MongoWebhookLogRepository, MongoWebhookRepository} from "./function/webhook.js";
import {
  BUCKET_DATA_REPOSITORY,
  BUCKET_REPOSITORY,
  BUCKET_SCHEMA_MANAGER
} from "@spica-server/interface-bucket";
import {HISTORY_REPOSITORY} from "@spica-server/interface-bucket-history";
import {MongoBucketRepository} from "./bucket/bucket.js";
import {MongoBucketDataRepository} from "./bucket/bucket-data.js";
import {MongoBucketSchemaManager} from "./bucket/schema-manager.js";
import {MongoHistoryRepository} from "./bucket/history.js";
import {DASHBOARD_REPOSITORY} from "@spica-server/interface-dashboard";
import {MongoDashboardRepository} from "./dashboard/dashboard.js";
import {ASSET_REPOSITORY} from "@spica-server/interface-asset";
import {MongoAssetRepository} from "./asset/asset.js";
import {ACTIVITY_REPOSITORY} from "@spica-server/interface-activity";
import {MongoActivityRepository} from "./activity/activity.js";
import {CONFIG_REPOSITORY} from "@spica-server/interface-config";
import {MongoConfigRepository} from "./config/config.js";
import {ENV_VAR_REPOSITORY} from "@spica-server/interface-env_var";
import {MongoEnvVarRepository} from "./env_var/env-var.js";
import {SECRET_REPOSITORY} from "@spica-server/interface-secret";
import {MongoSecretRepository} from "./secret/secret.js";
import {PREFERENCE_REPOSITORY} from "@spica-server/interface-preference";
import {MongoPreferenceRepository} from "./preference/preference.js";
import {STATUS_REPOSITORY} from "@spica-server/interface-status";
import {MongoStatusRepository} from "./status/status.js";
import {JOB_REPOSITORY} from "@spica-server/interface-replication";
import {MongoJobRepository} from "./replication/job.js";
import {COMMAND_REPOSITORY} from "@spica-server/interface-replication";
import {MongoCommandRepository} from "./replication/command.js";
import {FUNCTION_ASSET_REPOSITORY} from "@spica-server/interface-function-asset-storage";
import {MongoFunctionAssetRepository} from "./function/asset.js";
import {STORAGE_REPOSITORY} from "@spica-server/interface-storage";
import {MongoStorageRepository} from "./storage/storage.js";

export const repositoryClasses: RepositoryClasses = new Map<symbol, RepositoryClass>([
  [REFRESH_TOKEN_REPOSITORY, MongoRefreshTokenRepository],
  [APIKEY_REPOSITORY, MongoApiKeyRepository],
  [STRATEGY_REPOSITORY, MongoStrategyRepository],
  [POLICY_REPOSITORY, MongoPolicyRepository],
  [IDENTITY_REPOSITORY, MongoIdentityRepository],
  [USER_REPOSITORY, MongoUserRepository],
  [VERIFICATION_REPOSITORY, MongoVerificationRepository],
  [FUNCTION_REPOSITORY, MongoFunctionRepository],
  [FUNCTION_LOG_REPOSITORY, MongoFunctionLogRepository],
  [FUNCTION_LOG_SINK, MongoFunctionLogSink],
  [WEBHOOK_REPOSITORY, MongoWebhookRepository],
  [WEBHOOK_LOG_REPOSITORY, MongoWebhookLogRepository],
  [BUCKET_REPOSITORY, MongoBucketRepository],
  [BUCKET_DATA_REPOSITORY, MongoBucketDataRepository],
  [BUCKET_SCHEMA_MANAGER, MongoBucketSchemaManager],
  [HISTORY_REPOSITORY, MongoHistoryRepository],
  [DASHBOARD_REPOSITORY, MongoDashboardRepository],
  [ASSET_REPOSITORY, MongoAssetRepository],
  [ACTIVITY_REPOSITORY, MongoActivityRepository],
  [CONFIG_REPOSITORY, MongoConfigRepository],
  [ENV_VAR_REPOSITORY, MongoEnvVarRepository],
  [SECRET_REPOSITORY, MongoSecretRepository],
  [PREFERENCE_REPOSITORY, MongoPreferenceRepository],
  [STATUS_REPOSITORY, MongoStatusRepository],
  [JOB_REPOSITORY, MongoJobRepository],
  [COMMAND_REPOSITORY, MongoCommandRepository],
  [FUNCTION_ASSET_REPOSITORY, MongoFunctionAssetRepository],
  [STORAGE_REPOSITORY, MongoStorageRepository]
]);
