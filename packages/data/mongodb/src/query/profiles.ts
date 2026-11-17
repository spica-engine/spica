export type RelationPlacement = "before-filter" | "after-filter" | "after-seek";

export interface Relation {
  placement: RelationPlacement;
  stages: object[];
}

export interface ReadProfile {
  relations: {[name: string]: Relation};
}

const lookup = (from: string, field: string) => ({
  $lookup: {from, localField: field, foreignField: "_id", as: field}
});

const resolveName = (from: string, field: string) => [
  lookup(from, field),
  {$unwind: {path: `$${field}`, preserveNullAndEmptyArrays: true}},
  {$set: {[field]: `$${field}.${field}`}}
];

const profiles: {[collection: string]: ReadProfile} = {
  activity: {
    relations: {
      identifier: {placement: "before-filter", stages: resolveName("identity", "identifier")},
      username: {placement: "before-filter", stages: resolveName("user", "username")}
    }
  },
  function: {
    relations: {
      env_vars: {placement: "after-filter", stages: [lookup("env_var", "env_vars")]},
      secrets: {placement: "after-filter", stages: [lookup("secret", "secrets")]}
    }
  },
  function_logs: {
    relations: {
      function: {
        placement: "after-seek",
        stages: [
          {$set: {fn_id: {$toObjectId: "$function"}}},
          {$lookup: {from: "function", localField: "fn_id", foreignField: "_id", as: "fn"}},
          {$unwind: {path: "$fn", preserveNullAndEmptyArrays: true}},
          {$set: {function: {$ifNull: ["$fn.name", "$function"]}}},
          {$unset: ["fn", "fn_id"]}
        ]
      }
    }
  }
};

export function relationsOf(collection: string, names: string[] = []): Relation[] {
  return names.map(name => {
    const relation = profiles[collection]?.relations[name];
    if (!relation) {
      throw new Error(`Collection ${collection} has no relation named ${name}.`);
    }
    return relation;
  });
}
