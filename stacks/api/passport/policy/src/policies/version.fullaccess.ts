export default {
  _id: "VersionControlFullAccess",
  name: "Version Control Full Access",
  description: "Full access to version control service.",
  statement: [
    {
      action: "versioncontrol:update",
      module: "versioncontrol"
    }
  ]
};
