export default {
  _id: "StrategyReadOnlyAccess",
  name: "Strategy Read Only Access",
  description: "Read only access to passport strategy service.",
  statement: [
    {
      action: "passport:strategy:index",
      resource: ["*"],
      module: "passport:strategy"
    },
    {
      action: "passport:strategy:show",
      resource: ["*"],
      module: "passport:strategy"
    }
  ]
};
