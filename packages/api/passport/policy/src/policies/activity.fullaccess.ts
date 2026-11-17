import ActivityReadOnlyAccess from "./activity.readonly.js";

export default {
  name: "Activity Full Access",
  description: "Full access to activity service.",
  statement: [
    ...ActivityReadOnlyAccess.statement,
    {
      action: "activity:delete",
      module: "activity"
    }
  ]
};
