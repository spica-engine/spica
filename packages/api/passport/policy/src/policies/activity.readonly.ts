export default {
  name: "Activity Read Only Access",
  description: "Read only access to activity service.",
  statement: [
    {
      action: "activity:index",
      module: "activity"
    }
  ]
};
