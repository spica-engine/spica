export default {
  _id: "RefreshTokenReadOnlyAccess",
  name: "Refresh Token Read Only Access",
  description: "Read only access to refresh token service.",
  statement: [
    {
      action: "passport:refresh-token:index",
      resource: {include: ["*"], exclude: []},
      module: "passport:refresh-token"
    },
    {
      action: "passport:refresh-token:show",
      resource: {include: ["*"], exclude: []},
      module: "passport:refresh-token"
    },
    {
      action: "passport:refresh-token:stream",
      resource: {include: ["*"], exclude: []},
      module: "passport:refresh-token"
    }
  ]
};
