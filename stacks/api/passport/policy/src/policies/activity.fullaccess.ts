import ActivityReadOnlyAccess from "./activity.readonly";

export default {
  _id: "ActivityFullAccess",
  name: "Activity FullAccess",
  description: "Full access to activity service.",
  statement: [
    ...ActivityReadOnlyAccess.statement,
    {
      action: "activity:delete",
      module: "activity"
    }
  ]
};
