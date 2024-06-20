export default {
  _id: "RefreshTokenFullAccess",
  name: "Refresh Token Full Access",
  description: "Full access to refresh token service.",
  statement: [
    {
      action: "passport:refreshtoken:delete",
      resource: {include: ["*"], exclude: []},
      module: "passport:refreshtoken"
    },
    {
      action: "passport:refreshtoken:index",
      resource: {include: ["*"], exclude: []},
      module: "passport:refreshtoken"
    },
    {
      action: "passport:refreshtoken:show",
      resource: {include: ["*"], exclude: []},
      module: "passport:refreshtoken"
    }
  ]
};
