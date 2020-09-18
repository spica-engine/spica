export default {
  _id: "FunctionFullAccess",
  name: "Function Full Access",
  description: "Full access to function service.",
  statement: [
    {
      action: "function:index",
      resource: {
        include: "*"
      },
      module: "function"
    },
    {
      action: "function:show",
      resource: {
        include: "*"
      },
      module: "function"
    },
    {
      action: "function:create",
      module: "function"
    },
    {
      action: "function:update",
      resource: {
        include: "*"
      },
      module: "function"
    },
    {
      action: "function:delete",
      resource: {
        include: "*"
      },
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
