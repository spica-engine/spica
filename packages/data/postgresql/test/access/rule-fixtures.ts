import {describeBucket, loadRelatedBuckets} from "@spica-server/data-postgresql";

export const bucketId = "0198a7e0-7b1c-7d2e-9f3a-4b5c6d7e8f90";
export const otherId = "0198a7e0-7b1c-7d2e-9f3a-4b5c6d7e8f91";
export const uuid = "0192f3a0-0000-7000-8000-00000000000a";

export const ruleBucket: any = {
  title: "Rules",
  primary: "id",
  acl: {read: "true==true", write: "true==true"},
  properties: {
    id: {type: "uuid", options: {generated: true}},
    title: {type: "string"},
    age: {type: "number"},
    count: {type: "integer"},
    big: {type: "bigint"},
    active: {type: "boolean"},
    created: {type: "date"},
    owner: {type: "uuid"},
    password: {type: "hash"},
    secret: {type: "encrypted"},
    note: {type: "json"},
    address: {type: "object", properties: {city: {type: "string"}}},
    tags: {type: "array", items: {type: "string"}},
    scores: {type: "array", items: {type: "integer"}},
    docs: {type: "array", items: {type: "json"}},
    lines: {type: "array", items: {type: "object", properties: {sku: {type: "string"}}}},
    label: {type: "string", options: {translate: true}},
    editors: {type: "relation", bucketId: otherId, relationType: "onetomany"},
    author: {type: "relation", bucketId: otherId, relationType: "onetoone"}
  }
};

export const thirdId = "0198a7e0-7b1c-7d2e-9f3a-4b5c6d7e8f92";

export const thirdBucket: any = {
  id: thirdId,
  title: "Third",
  primary: "id",
  acl: {read: "true==true", write: "true==true"},
  properties: {
    id: {type: "uuid", options: {generated: true}},
    title: {type: "string"},
    rank: {type: "integer"}
  }
};

export const otherBucket: any = {
  id: otherId,
  title: "Other",
  primary: "id",
  acl: {read: "true==true", write: "true==true"},
  properties: {
    id: {type: "uuid", options: {generated: true}},
    name: {type: "string"},
    level: {type: "integer"},
    joined: {type: "date"},
    pin: {type: "hash"},
    secret: {type: "encrypted"},
    tags: {type: "array", items: {type: "string"}},
    boss: {type: "relation", bucketId: thirdId, relationType: "onetoone"}
  }
};

const stored: Record<string, any> = {[otherId]: otherBucket, [thirdId]: thirdBucket};

export const findBucket = async (id: string) => stored[id];

const pk = {field: "id", type: "uuid" as const, generated: true, column: "id"};

export const targets = (id: string) =>
  id == otherId || id == thirdId ? {table: `bucket_${id}`, primaryKey: pk} : undefined;

export const ruleMetadata = describeBucket(bucketId, ruleBucket, targets);

export const otherMetadata = describeBucket(otherId, otherBucket, targets);

export const thirdMetadata = describeBucket(thirdId, thirdBucket, targets);

export const relatedFor = (rule: string | string[]) =>
  loadRelatedBuckets({bucket: ruleBucket, metadata: ruleMetadata, bucketId}, rule, findBucket);

export const withFieldRules = (rules: Record<string, string>): any => ({
  ...ruleBucket,
  properties: Object.fromEntries(
    Object.entries(ruleBucket.properties).map(([name, property]) => [
      name,
      rules[name] ? {...(property as object), acl: rules[name]} : property
    ])
  )
});
