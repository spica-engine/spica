export default {
  _id: "EnvVarReadOnlyAccess",
  name: "Environment Variables Read Only Access",
  description: "Read only access to function environment variables service.",
  statement: [
    {
      action: "env-var:index",
      resource: {include: ["*"], exclude: []},
      module: "env-var"
    },
    {
      action: "env-var:show",
      resource: {include: ["*"], exclude: []},
      module: "env-var"
    },
    {
      action: "env-var:stream",
      resource: {include: ["*"], exclude: []},
      module: "env-var"
    }
  ]
};
