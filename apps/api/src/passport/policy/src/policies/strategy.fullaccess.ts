import StrategyReadOnlyAccess from "./strategy.readonly";

export default {
  _id: "StrategyFullAccess",
  name: "Strategy Full Access",
  description: "Full access to passport strategy service.",
  statement: [
    ...StrategyReadOnlyAccess.statement,
    {
      action: "passport:strategy:update",
      resource: {include: ["*"], exclude: []},
      module: "passport:strategy"
    },
    {
      action: "passport:strategy:insert",
      module: "passport:strategy"
    },
    {
      action: "passport:strategy:delete",
      resource: {include: ["*"], exclude: []},
      module: "passport:strategy"
    }
  ]
};
