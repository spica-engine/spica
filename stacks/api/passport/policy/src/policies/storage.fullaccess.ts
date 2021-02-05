import StorageReadOnlyAccess from "./storage.readonly";

export default {
  _id: "StorageFullAccess",
  name: "Storage Full Access",
  description: "Full access to storage service.",
  statement: [
    ...StorageReadOnlyAccess.statement,
    {
      action: "storage:create",
      module: "storage"
    },
    {
      action: "storage:update",
      resource: {include: ["*"], exclude: []},
      module: "storage"
    },
    {
      action: "storage:delete",
      resource: {include: ["*"], exclude: []},
      module: "storage"
    }
  ]
};
