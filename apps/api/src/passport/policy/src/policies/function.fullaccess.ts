import FunctionReadOnlyAccess from "./function.readonly";

export default {
  _id: "FunctionFullAccess",
  name: "Function Full Access",
  description: "Full access to function service.",
  statement: [
    ...FunctionReadOnlyAccess.statement,
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
    },
    {
      action: "function:integrations",
      module: "function"
    }
  ]
};
