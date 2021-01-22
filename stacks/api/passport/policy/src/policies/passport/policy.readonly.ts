export default {
  _id: "PolicyReadOnlyAccess",
  name: "Policy Read Only Access",
  description: "Read only access to passport policy service.",
  statement: [
    {
      action: "passport:policy:index",
      resource: ["*"],
      module: "passport:policy"
    },
    {
      action: "passport:policy:show",
      resource: ["*"],
      module: "passport:policy"
    }
  ]
};
