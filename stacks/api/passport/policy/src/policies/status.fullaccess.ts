export default {
  _id: "StatusFullAccess",
  name: "Status Full Access",
  description: "Full access to status service.",
  statement: [
    {
      action: "status:index",
      resource: {include: ["*"], exclude: []},
      module: "status"
    },
    {
      action: "status:show",
      resource: {include: ["*"], exclude: []},
      module: "status"
    }
  ]
};
