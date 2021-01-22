export default {
  _id: "BucketReadOnlyAccess",
  name: "Bucket Read Only Access",
  description: "Read only access to bucket service.",
  statement: [
    {
      action: "bucket:index",
      resource: ["*"],
      module: "bucket"
    },
    {
      action: "bucket:show",
      resource: ["*"],
      module: "bucket"
    },
    {
      action: "bucket:data:stream",
      resource: ["*/*"],
      module: "bucket:data"
    },
    {
      action: "bucket:data:index",
      resource: ["*/*"],
      module: "bucket:data"
    },
    {
      action: "bucket:data:show",
      resource: ["*/*"],
      module: "bucket:data"
    },
    {
      action: "preference:show",
      module: "preference",
      resource: ["bucket"]
    }
  ]
};
