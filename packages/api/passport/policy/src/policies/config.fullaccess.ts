import ConfigReadOnlyAccess from "./config.readonly.js";

export default {
  name: "Configuration Full Access",
  description: "Full access to configuration service.",
  statement: [
    ...ConfigReadOnlyAccess.statement,
    {
      action: "config:update",
      resource: {include: ["*"], exclude: []},
      module: "config"
    }
  ]
};
