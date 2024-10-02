export default {
  _id: "FunctionReadOnlyAccess",
  name: "Function Read Only Access",
  description: "Read only access to function service.",
  statement: [
    {
      action: "function:index",
      resource: {include: ["*"], exclude: []},
      module: "function"
    },
    {
      action: "function:show",
      resource: {include: ["*"], exclude: []},
      module: "function"
    },
    {
      action: "function:logs:index",
      module: "function:logs"
    }
  ]
};
