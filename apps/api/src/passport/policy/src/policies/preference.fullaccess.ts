import PreferenceReadOnly from "./preference.readonly";

export default {
  _id: "PreferenceFullAccess",
  name: "Preference Full Access",
  description: "Full access to preference service.",
  statement: [
    ...PreferenceReadOnly.statement,
    {
      action: "preference:update",
      resource: {include: ["*"], exclude: []},
      module: "preference"
    }
  ]
};
