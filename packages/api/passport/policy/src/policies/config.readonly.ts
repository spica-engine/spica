export default {
  _id: "ConfigReadOnlyAccess",
  name: "Configuration Read Only Access",
  description: "Read only access to configuration service.",
  statement: [
    {
      action: "config:index",
      resource: {include: ["*"], exclude: []},
      module: "config"
    },
    {
      action: "config:show",
      resource: {include: ["*"], exclude: []},
      module: "config"
    }
  ]
};
