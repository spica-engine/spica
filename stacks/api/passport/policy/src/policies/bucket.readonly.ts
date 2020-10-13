export default {
  _id: "BucketReadOnlyAccess",
  name: "Bucket Read Only Access",
  description: "Read only access to bucket service.",
  statement: [
    {
      action: "bucket:index",
      resource: {
        include: "*"
      },
      module: "bucket"
    },
    {
      action: "bucket:show",
      resource: {
        include: "*"
      },
      module: "bucket"
    },
    {
      action: "bucket:data:stream",
      resource: {
        include: "*/*"
      },
      module: "bucket:data"
    },
    {
      action: "bucket:data:index",
      resource: {
        include: "*/*"
      },
      module: "bucket:data"
    },
    {
      action: "bucket:data:show",
      resource: {
        include: "*/*"
      },
      module: "bucket:data"
    },
    {
      action: "preference:show",
      module: "preference",
      resource: ["bucket"]
    }
  ]
};
