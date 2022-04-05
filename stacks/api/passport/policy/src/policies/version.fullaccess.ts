export default {
  _id: "VersionFullAccess",
  name: "Version Control Full Access",
  description: "Full access to version control service.",
  statement: [
    {
      action: "versioncontrol:update",
      resource: {include: ["*"], exclude: []},
      module: "versioncontrol"
    }
  ]
};
