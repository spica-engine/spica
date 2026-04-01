import FunctionReadOnlyAccess from "./function.readonly.js";
import EnvVarFullAccess from "./env.var.fullaccess.js";
import SecretFullAccess from "./secret.fullaccess.js";

export default {
  _id: "FunctionFullAccess",
  name: "Function Full Access",
  description: "Full access to function service.",
  statement: [
    ...FunctionReadOnlyAccess.statement,
    ...EnvVarFullAccess.statement,
    ...SecretFullAccess.statement,
    {
      action: "function:invoke",
      resource: {include: ["*/*"], exclude: []},
      module: "function:invoke"
    },
    {
      action: "function:create",
      module: "function"
    },
    {
      action: "function:update",
      resource: {include: ["*"], exclude: []},
      module: "function"
    },
    {
      action: "function:delete",
      resource: {include: ["*"], exclude: []},
      module: "function"
    },
    {
      action: "function:logs:delete",
      module: "function:logs"
    }
  ]
};
