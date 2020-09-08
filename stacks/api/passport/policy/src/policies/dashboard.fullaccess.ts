import DashboardReadOnlyAccess from "./dashboard.readonly";

export default {
  _id: "DashboardFullAccess",
  name: "Dashboard Full Access",
  description: "Full access to dashboard service.",
  statement: [
    ...DashboardReadOnlyAccess.statement,
    {
      action: "dashboard:update",
      resource: {
        include: "*"
      },
      module: "dashboard"
    },
    {
      action: "dashboard:delete",
      resource: {
        include: "*"
      },
      module: "dashboard"
    }
  ]
};
