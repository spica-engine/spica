export default {
  _id: "EnvVarsReadOnlyAccess",
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
    }
  ]
};
