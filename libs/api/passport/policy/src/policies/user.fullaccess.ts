import UserReadOnlyAccess from "./user.readonly";

export default {
  _id: "UserFullAccess",
  name: "User Full Access",
  description: "Full access to passport user service.",
  statement: [
    ...UserReadOnlyAccess.statement,
    {
      action: "passport:user:create",
      module: "passport:user"
    },
    {
      action: "passport:user:update",
      resource: {include: ["*"], exclude: []},
      module: "passport:user"
    },
    {
      action: "passport:user:delete",
      resource: {include: ["*"], exclude: []},
      module: "passport:user"
    },
    {
      action: "passport:user:profile",
      module: "passport:user"
    },
    {
      action: "passport:user:policy:add",
      resource: {include: ["*/*"], exclude: []},
      module: "passport:user:policy"
    },
    {
      action: "passport:user:policy:remove",
      resource: {include: ["*/*"], exclude: []},
      module: "passport:user:policy"
    },
    {
      action: "preference:update",
      module: "preference",
      resource: {
        include: ["passport"],
        exclude: []
      }
    }
  ]
};
