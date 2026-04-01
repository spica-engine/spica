export default {
  _id: "SecretReadOnlyAccess",
  name: "Secrets Read Only Access",
  description: "Read only access to secrets service.",
  statement: [
    {
      action: "secret:index",
      resource: {include: ["*"], exclude: []},
      module: "secret"
    },
    {
      action: "secret:show",
      resource: {include: ["*"], exclude: []},
      module: "secret"
    },
    {
      action: "secret:stream",
      resource: {include: ["*"], exclude: []},
      module: "secret"
    }
  ]
};
