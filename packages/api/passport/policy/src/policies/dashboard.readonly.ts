export default {
  _id: "DashboardReadOnlyAccess",
  name: "Dashboard Read Only Access",
  description: "Read only access to dashboard service.",
  statement: [
    {
      action: "dashboard:index",
      resource: {include: ["*"], exclude: []},
      module: "dashboard"
    },
    {
      action: "dashboard:show",
      resource: {include: ["*"], exclude: []},
      module: "dashboard"
    },
    {
      action: "dashboard:stream",
      resource: {include: ["*"], exclude: []},
      module: "dashboard"
    }
  ]
};
