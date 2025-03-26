import EnvVarReadonlyAccess from "./env.var.readonly";

export default {
  _id: "EnvVarFullAccess",
  name: "Environment Variables Full Access",
  description: "Full access to function environment variables service.",
  statement: [
    ...EnvVarReadonlyAccess.statement,
    {
      action: "env-var:create",
      module: "env-var"
    },
    {
      action: "env-var:update",
      resource: {include: ["*"], exclude: []},
      module: "env-var"
    },
    {
      action: "env-var:delete",
      resource: {include: ["*"], exclude: []},
      module: "env-var"
    },
    {
      action: "function:env-var:inject",
      resource: {include: ["*/*"], exclude: []},
      module: "function:env-var"
    },
    {
      action: "function:env-var:eject",
      resource: {include: ["*/*"], exclude: []},
      module: "function:env-var"
    }
  ]
};
