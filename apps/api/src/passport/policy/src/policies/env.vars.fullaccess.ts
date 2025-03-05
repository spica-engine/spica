import EnvVarsReadonlyAccess from "./env.vars.readonly";

export default {
  _id: "EnvVarsFullAccess",
  name: "Environment Variables Full Access",
  description: "Full access to function environment variables service.",
  statement: [
    ...EnvVarsReadonlyAccess.statement,
    {
      action: "env-vars:create",
      module: "env-vars"
    },
    {
      action: "env-vars:update",
      resource: {include: ["*"], exclude: []},
      module: "env-vars"
    },
    {
      action: "env-vars:delete",
      resource: {include: ["*"], exclude: []},
      module: "env-vars"
    },
    {
      action: "function:env-vars:inject",
      resource: {include: ["*/*"], exclude: []},
      module: "function:env-vars"
    },
    {
      action: "function:env-vars:eject",
      resource: {include: ["*/*"], exclude: []},
      module: "function:env-vars"
    }
  ]
};
