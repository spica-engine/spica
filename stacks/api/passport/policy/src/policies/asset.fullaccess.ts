import AssetReadOnlyAccess from "./asset.readonly";

export default {
  _id: "AssetFullAccess",
  name: "Asset Full Access",
  description: "Full access to asset service.",
  statement: [
    ...AssetReadOnlyAccess.statement,
    {
      action: "apis:create",
      module: "apis"
    },
    {
      action: "apis:update",
      module: "apis"
    },
    {
      action: "apis:delete",
      module: "apis"
    }
  ]
};
