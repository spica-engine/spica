import ApiKeyReadOnlyAccess from "./apikey.readonly";

export default {
  _id: "ApiKeyFullAccess",
  name: "Api Key Full Access",
  description: "Full access to passport api service.",
  statement: [
    ...ApiKeyReadOnlyAccess.statement,
    {
      action: "passport:apikey:create",
      module: "passport:apikey"
    },
    {
      action: "passport:apikey:update",
      resource: {include: ["*"], exclude: []},
      module: "passport:apikey"
    },
    {
      action: "passport:apikey:delete",
      resource: {include: ["*"], exclude: []},
      module: "passport:apikey"
    },
    {
      action: "passport:apikey:policy:add",
      resource: {include: ["*/*"], exclude: []},
      module: "passport:apikey:policy"
    },
    {
      action: "passport:apikey:policy:remove",
      resource: {include: ["*/*"], exclude: []},
      module: "passport:apikey:policy"
    }
  ]
};
