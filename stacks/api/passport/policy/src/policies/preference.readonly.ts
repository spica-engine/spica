export default {
  _id: "PreferenceReadOnlyAccess",
  name: "Preference ReadOnly Access",
  description: "Read only access to preference service.",
  statement: [
    {
      action: "preference:show",
      resource: {include: ["*"], exclude: []},
      module: "preference"
    }
  ]
};
