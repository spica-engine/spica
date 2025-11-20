export default {
  _id: "UserReadOnlyAccess",
  name: "User Read Only Access",
  description: "Read only access to passport user service.",
  statement: [
    {
      action: "passport:user:index",
      resource: {include: ["*"], exclude: []},
      module: "passport:user"
    },
    {
      action: "passport:user:show",
      resource: {include: ["*"], exclude: []},
      module: "passport:user"
    },
    {
      action: "passport:user:stream",
      resource: {include: ["*"], exclude: []},
      module: "passport:user"
    },
    {
      action: "preference:show",
      module: "preference",
      resource: {
        include: ["passport"],
        exclude: []
      }
    }
  ]
};
