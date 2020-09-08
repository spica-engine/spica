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
      resource: {
        include: "*"
      },
      module: "bucket"
    },
    {
      action: "bucket:delete",
      resource: {
        include: "*"
      },
      module: "bucket"
    },
    {
      action: "bucket:data:create",
      resource: {
        include: "*"
      },
      module: "bucket:data"
    },
    {
      action: "bucket:data:update",
      resource: {
        include: "*/*"
      },
      module: "bucket:data"
    },
    {
      action: "bucket:data:delete",
      resource: {
        include: "*/*"
      },
      module: "bucket:data"
    }
  ]
};
