export default {
  _id: "WebhookReadOnlyAccess",
  name: "Webhook Readonly Access",
  description: "Read only access to webhook service.",
  statement: [
    {
      action: "webhook:index",
      resource: {
        include: "*",
        exclude: []
      },
      module: "webhook"
    },
    {
      action: "webhook:show",
      resource: {
        include: "*",
        exclude: []
      },
      module: "webhook"
    },
    {
      action: "webhook:logs:index",
      module: "webhook:logs"
    },
  ]
};
