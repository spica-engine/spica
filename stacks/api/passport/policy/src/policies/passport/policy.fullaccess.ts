import PolicyReadOnlyAccess from "./policy.readonly";

export default {
  _id: "PolicyFullAccess",
  name: "Policy Full Access",
  description: "Full access to passport policy service.",
  statement: [
    ...PolicyReadOnlyAccess.statement,
    {
      action: "passport:policy:create",
      module: "passport:policy"
    },
    {
      action: "passport:policy:update",
      resource: {include: ["*"], exclude: []},
      module: "passport:policy"
    },
    {
      action: "passport:policy:delete",
      resource: {
        include: ["*"],
        exclude: []
      },
      module: "passport:policy"
    }
  ]
};
