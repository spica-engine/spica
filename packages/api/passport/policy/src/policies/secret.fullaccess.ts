import SecretReadOnlyAccess from "./secret.readonly";

export default {
  _id: "SecretFullAccess",
  name: "Secrets Full Access",
  description: "Full access to secrets service.",
  statement: [
    ...SecretReadOnlyAccess.statement,
    {
      action: "secret:create",
      module: "secret"
    },
    {
      action: "secret:update",
      resource: {include: ["*"], exclude: []},
      module: "secret"
    },
    {
      action: "secret:delete",
      resource: {include: ["*"], exclude: []},
      module: "secret"
    },
    {
      action: "function:secret:inject",
      resource: {include: ["*/*"], exclude: []},
      module: "function:secret"
    },
    {
      action: "function:secret:eject",
      resource: {include: ["*/*"], exclude: []},
      module: "function:secret"
    }
  ]
};
