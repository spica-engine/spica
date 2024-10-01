import WebhookReadOnlyAccess from "./webhook.readonly";

export default {
  _id: "WebhookFullAccess",
  name: "Webhook Full Access",
  description: "Full acess to webhook service",
  statement: [
    ...WebhookReadOnlyAccess.statement,
    {
      action: "webhook:create",
      module: "webhook"
    },
    {
      action: "webhook:update",
      resource: {include: ["*"], exclude: []},
      module: "webhook"
    },
    {
      action: "webhook:delete",
      resource: {include: ["*"], exclude: []},
      module: "webhook"
    },
    {
      action: "webhook:logs:delete",
      module: "webhook:logs"
    }
  ]
};
