export default {
  _id: "DashboardReadOnlyAccess",
  name: "Dashboard Read Only Access",
  description: "Read only access to dashboard service.",
  statement: [
    {
      action: "dashboard:index",
      resource: ["*"],
      module: "dashboard"
    },
    {
      action: "dashboard:show",
      resource: ["*"],
      module: "dashboard"
    }
  ]
};
