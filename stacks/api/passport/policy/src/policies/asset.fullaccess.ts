import AssetReadOnlyAccess from "./asset.readonly";

export default {
  _id: "AssetFullAccess",
  name: "Asset Full Access",
  description: "Full access to asset service.",
  statement: [
    ...AssetReadOnlyAccess.statement,
    {
      action: "asset:download",
      module: "asset"
    },
    {
      action: "asset:install",
      module: "asset"
    },
    {
      action: "asset:delete",
      module: "asset"
    }
  ]
};
