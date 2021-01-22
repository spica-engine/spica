export default {
  _id: "FunctionFullAccess",
  name: "Function Full Access",
  description: "Full access to function service.",
  statement: [
    {
      action: "function:index",
      resource: ["*"],
      module: "function"
    },
    {
      action: "function:show",
      resource: ["*"],
      module: "function"
    },
    {
      action: "function:create",
      module: "function"
    },
    {
      action: "function:update",
      resource: ["*"],
      module: "function"
    },
    {
      action: "function:delete",
      resource: ["*"],
      module: "function"
    },
    {
      action: "function:logs:index",
      module: "function:logs"
    },
    {
      action: "function:logs:delete",
      module: "function:logs"
    }
  ]
};
