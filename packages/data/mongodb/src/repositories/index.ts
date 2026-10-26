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
import {FUNCTION_LOG_REPOSITORY} from "@spica-server/interface-function-log";
import {WEBHOOK_LOG_REPOSITORY, WEBHOOK_REPOSITORY} from "@spica-server/interface-function-webhook";
import {MongoFunctionRepository} from "./function/function.js";
import {MongoFunctionLogRepository} from "./function/log.js";
import {MongoWebhookLogRepository, MongoWebhookRepository} from "./function/webhook.js";

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
  [WEBHOOK_REPOSITORY, MongoWebhookRepository],
  [WEBHOOK_LOG_REPOSITORY, MongoWebhookLogRepository]
]);
