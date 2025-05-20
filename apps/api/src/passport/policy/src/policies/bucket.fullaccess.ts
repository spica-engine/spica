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
      resource: {include: ["*"], exclude: []},
      module: "bucket"
    },
    {
      action: "bucket:delete",
      resource: {include: ["*"], exclude: []},
      module: "bucket"
    },
    {
      action: "bucket:data:create",
      resource: {include: ["*"], exclude: []},
      module: "bucket:data"
    },
    {
      action: "bucket:data:update",
      resource: {include: ["*/*"], exclude: []},
      module: "bucket:data"
    },
    {
      action: "bucket:data:delete",
      resource: {include: ["*/*"], exclude: []},
      module: "bucket:data"
    },
    {
      action: "bucket:data:profile",
      resource: {include: ["*"], exclude: []},
      module: "bucket:data"
    },
    {
      action: "preference:update",
      module: "preference",
      resource: {
        include: ["bucket"],
        exclude: []
      }
    }
  ]
};
