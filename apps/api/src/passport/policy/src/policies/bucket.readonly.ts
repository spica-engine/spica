export default {
  _id: "BucketReadOnlyAccess",
  name: "Bucket Read Only Access",
  description: "Read only access to bucket service.",
  statement: [
    {
      action: "bucket:stream",
      resource: {include: ["*"], exclude: []},
      module: "bucket"
    },
    {
      action: "bucket:index",
      resource: {include: ["*"], exclude: []},
      module: "bucket"
    },
    {
      action: "bucket:show",
      resource: {include: ["*"], exclude: []},
      module: "bucket"
    },
    {
      action: "bucket:data:stream",
      resource: {include: ["*/*"], exclude: []},
      module: "bucket:data"
    },
    {
      action: "bucket:data:index",
      resource: {include: ["*/*"], exclude: []},
      module: "bucket:data"
    },
    {
      action: "bucket:data:show",
      resource: {include: ["*/*"], exclude: []},
      module: "bucket:data"
    },
    {
      action: "preference:show",
      module: "preference",
      resource: {
        include: ["bucket"],
        exclude: []
      }
    }
  ]
};
