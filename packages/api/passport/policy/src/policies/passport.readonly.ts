import IdentityReadOnly from "./identity.readonly.js";
import StrategyReadOnly from "./strategy.readonly.js";
import ApiKeyReadOnly from "./apikey.readonly.js";
import PolicyReadOnly from "./policy.readonly.js";
import RefreshTokenReadonlyAccess from "./refresh.token.readonly.js";
import UserReadOnly from "./user.readonly.js";

export default {
  _id: "PassportReadOnlyAccess",
  name: "Passport Read Only Access",
  description: "Read only access to passport identity service and policy service.",
  statement: [
    ...IdentityReadOnly.statement,
    ...ApiKeyReadOnly.statement,
    ...PolicyReadOnly.statement,
    ...StrategyReadOnly.statement,
    ...RefreshTokenReadonlyAccess.statement,
    ...UserReadOnly.statement
  ]
};
