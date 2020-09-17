import IdentityReadOnly from "./identity.readonly";
import StrategyReadOnly from "./strategy.readonly";
import ApiKeyReadOnly from "./apikey.readonly";
import PolicyReadOnly from "./policy.readonly";

export default {
  _id: "PassportReadOnlyAccess",
  name: "Passport Read Only Access",
  description: "Read only access to passport identity service and policy service.",
  statement: [
    ...IdentityReadOnly.statement,
    ...ApiKeyReadOnly.statement,
    ...PolicyReadOnly.statement,
    ...StrategyReadOnly.statement
  ]
};
