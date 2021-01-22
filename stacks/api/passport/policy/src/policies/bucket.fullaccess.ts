import BucketReadOnlyAccess from "./bucket.readonly";

export default {
  _id: "BucketFullAccess",
  name: "Bucket Full Access",
  description: "Full access to bucket service.",
  statement: [
    ...BucketReadOnlyAccess.statement,
    {
      action: "bucket:create",
      module: "bucket"
    },
    {
      action: "bucket:update",
      resource: ["*"],
      module: "bucket"
    },
    {
      action: "bucket:delete",
      resource: ["*"],
      module: "bucket"
    },
    {
      action: "bucket:data:create",
      resource: ["*"],
      module: "bucket:data"
    },
    {
      action: "bucket:data:update",
      resource: ["*/*"],
      module: "bucket:data"
    },
    {
      action: "bucket:data:delete",
      resource: ["*/*"],
      module: "bucket:data"
    },
    {
      action: "preference:update",
      module: "preference",
      resource: ["bucket"]
    }
  ]
};
