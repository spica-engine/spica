import RefreshTokenReadOnlyAccess from "./refresh.token.readonly";

export default {
  _id: "RefreshTokenFullAccess",
  name: "Refresh Token Full Access",
  description: "Full access to refresh token service.",
  statement: [
    ...RefreshTokenReadOnlyAccess.statement,
    {
      action: "passport:refresh-token:delete",
      resource: {include: ["*"], exclude: []},
      module: "passport:refresh-token"
    },
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
      action: "passport:refresh-token:update",
      resource: {include: ["*"], exclude: []},
      module: "passport:refresh-token"
    }
  ]
};
