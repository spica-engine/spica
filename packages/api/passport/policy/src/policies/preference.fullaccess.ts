import PreferenceReadOnly from "./preference.readonly.js";

export default {
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
