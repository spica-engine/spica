import IdentityFullAccess from "./identity.fullaccess.js";
import StrategyFullAccess from "./strategy.fullaccess.js";
import ApiKeyFullAccess from "./apikey.fullaccess.js";
import PolicyFullAccess from "./policy.fullaccess.js";
import RefreshTokenFullAccess from "./refresh.token.fullaccess.js";
import UserFullAccess from "./user.fullaccess.js";

export default {
  _id: "PassportFullAccess",
  name: "Passport Full Access",
  description: "Full access to passport identity service and  policy service.",
  statement: [
    ...IdentityFullAccess.statement,
    ...ApiKeyFullAccess.statement,
    ...PolicyFullAccess.statement,
    ...StrategyFullAccess.statement,
    ...RefreshTokenFullAccess.statement,
    ...UserFullAccess.statement
  ]
};
