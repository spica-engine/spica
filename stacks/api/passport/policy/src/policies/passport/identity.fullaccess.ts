import IdentityReadOnlyAccess from "./identity.readonly";

export default {
  _id: "IdentityFullAccess",
  name: "Identity Full Access",
  description: "Full access to passport identity service.",
  statement: [
    ...IdentityReadOnlyAccess.statement,
    {
      action: "passport:identity:create",
      module: "passport:identity"
    },
    {
      action: "passport:identity:update",
      resource: ["*"],
      module: "passport:identity"
    },
    {
      action: "passport:identity:delete",
      resource: ["*"],
      module: "passport:identity"
    },
    {
      action: "passport:identity:policy:add",
      resource: ["*/*"],
      module: "passport:identity:policy"
    },
    {
      action: "passport:identity:policy:remove",
      resource: ["*/*"],
      module: "passport:identity:policy"
    },
    {
      action: "preference:update",
      module: "preference",
      resource: ["passport"]
    }
  ]
};
