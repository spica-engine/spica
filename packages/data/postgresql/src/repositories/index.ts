import {RepositoryClass, RepositoryClasses} from "@spica-server/interface-data";
import {STRATEGY_REPOSITORY} from "@spica-server/interface-passport";
import {APIKEY_REPOSITORY} from "@spica-server/interface-passport-apikey";
import {IDENTITY_REPOSITORY} from "@spica-server/interface-passport-identity";
import {POLICY_REPOSITORY} from "@spica-server/interface-passport-policy";
import {REFRESH_TOKEN_REPOSITORY} from "@spica-server/interface-passport-refresh_token";
import {USER_REPOSITORY, VERIFICATION_REPOSITORY} from "@spica-server/interface-passport-user";
import {PREFERENCE_REPOSITORY} from "@spica-server/interface-preference";
import {CONFIG_REPOSITORY} from "@spica-server/interface-config";
import {PostgresConfigRepository} from "./config/config.js";
import {PostgresApiKeyRepository} from "./passport/apikey.js";
import {PostgresIdentityRepository} from "./passport/identity.js";
import {PostgresPolicyRepository} from "./passport/policy.js";
import {PostgresRefreshTokenRepository} from "./passport/refresh-token.js";
import {PostgresStrategyRepository} from "./passport/strategy.js";
import {PostgresUserRepository, PostgresVerificationRepository} from "./passport/user.js";
import {PostgresPreferenceRepository} from "./preference/preference.js";

export const repositoryClasses: RepositoryClasses = new Map<symbol, RepositoryClass>([
  [REFRESH_TOKEN_REPOSITORY, PostgresRefreshTokenRepository],
  [APIKEY_REPOSITORY, PostgresApiKeyRepository],
  [STRATEGY_REPOSITORY, PostgresStrategyRepository],
  [POLICY_REPOSITORY, PostgresPolicyRepository],
  [IDENTITY_REPOSITORY, PostgresIdentityRepository],
  [USER_REPOSITORY, PostgresUserRepository],
  [VERIFICATION_REPOSITORY, PostgresVerificationRepository],
  [PREFERENCE_REPOSITORY, PostgresPreferenceRepository],
  [CONFIG_REPOSITORY, PostgresConfigRepository]
]);
