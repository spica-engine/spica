export default {
  _id: "BlacklistedTokenFullAccess",
  name: "Blacklisted Token Full Access",
  description: "Full access to blacklisted token service.",
  statement: [
    {
      action: "passport:blacklistedtoken:update",
      resource: {include: ["*"], exclude: []},
      module: "passport:blacklistedtoken"
    },
    {
      action: "passport:blacklistedtoken:create",
      module: "passport:blacklistedtoken"
    },
    {
      action: "passport:blacklistedtoken:delete",
      resource: {include: ["*"], exclude: []},
      module: "passport:blacklistedtoken"
    },
    {
      action: "passport:blacklistedtoken:index",
      resource: {include: ["*"], exclude: []},
      module: "passport:blacklistedtoken"
    },
    {
      action: "passport:blacklistedtoken:show",
      resource: {include: ["*"], exclude: []},
      module: "passport:blacklistedtoken"
    }
  ]
};
