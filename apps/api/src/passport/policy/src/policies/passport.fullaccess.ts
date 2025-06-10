import IdentityFullAccess from "./identity.fullaccess";
import StrategyFullAccess from "./strategy.fullaccess";
import ApiKeyFullAccess from "./apikey.fullaccess";
import PolicyFullAccess from "./policy.fullaccess";
import RefreshTokenFullAccess from "./refresh.token.fullaccess";

export default {
  _id: "PassportFullAccess",
  name: "Passport Full Access",
  description: "Full access to passport identity service and  policy service.",
  statement: [
    ...IdentityFullAccess.statement,
    ...ApiKeyFullAccess.statement,
    ...PolicyFullAccess.statement,
    ...StrategyFullAccess.statement,
    ...RefreshTokenFullAccess.statement
  ]
};
