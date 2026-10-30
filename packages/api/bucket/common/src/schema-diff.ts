import {Bucket} from "@spica-server/interface-bucket";
import {JSONSchema7} from "json-schema";

type Property = NonNullable<Bucket["properties"]>[string];

type SchemaNode = Record<string, any>;

export const ITEMS_SEGMENT = "[]";

export type FieldChange =
  | {kind: "added" | "removed"; path: string[]; property: Property}
  | {kind: "retyped"; path: string[]; previous: Property; next: Property}
  | {kind: "enum"; path: string[]; previous?: unknown[]; next?: unknown[]}
  | {kind: "required"; path: string[]; required: boolean}
  | {kind: "translate"; path: string[]; translate: boolean};

export type IndexChange = {
  kind: "added" | "removed";
  index: NonNullable<Bucket["indexes"]>[number];
};

export interface BucketDiff {
  fields: FieldChange[];
  indexes: IndexChange[];
}

const TYPE_KEYWORDS = ["type", "relationType", "bucketId"];

const isTyped = (a: SchemaNode, b: SchemaNode) =>
  TYPE_KEYWORDS.every(keyword => same(a[keyword], b[keyword]));

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function indexKey(index: IndexChange["index"]) {
  const options = index.options ?? {};
  return JSON.stringify([
    Object.entries(index.definition),
    Object.keys(options)
      .sort()
      .map(key => [key, options[key]])
  ]);
}

function diffIndexes(previous: Bucket, next: Bucket): IndexChange[] {
  const previousByKey = new Map((previous.indexes ?? []).map(index => [indexKey(index), index]));
  const nextByKey = new Map((next.indexes ?? []).map(index => [indexKey(index), index]));
  return [
    ...[...previousByKey]
      .filter(([key]) => !nextByKey.has(key))
      .map(([, index]) => ({kind: "removed" as const, index})),
    ...[...nextByKey]
      .filter(([key]) => !previousByKey.has(key))
      .map(([, index]) => ({kind: "added" as const, index}))
  ];
}

function diffProperty(
  path: string[],
  previous: SchemaNode,
  next: SchemaNode,
  changes: FieldChange[]
) {
  if (!isTyped(previous, next)) {
    changes.push({
      kind: "retyped",
      path,
      previous: previous as Property,
      next: next as Property
    });
    return;
  }

  if (Boolean(previous.options?.translate) !== Boolean(next.options?.translate)) {
    changes.push({kind: "translate", path, translate: Boolean(next.options?.translate)});
  }

  if (!same(previous.enum, next.enum)) {
    changes.push({kind: "enum", path, previous: previous.enum, next: next.enum});
  }

  if (next.type == "object") {
    diffProperties(path, previous, next, changes);
  } else if (next.type == "array" || next.type == "multiselect") {
    diffItems(path, previous, next, changes);
  }
}

function diffItems(path: string[], previous: SchemaNode, next: SchemaNode, changes: FieldChange[]) {
  const itemsPath = [...path, ITEMS_SEGMENT];
  const previousItems = previous.items as JSONSchema7 | JSONSchema7[] | undefined;
  const nextItems = next.items as JSONSchema7 | JSONSchema7[] | undefined;

  if (Array.isArray(previousItems) || Array.isArray(nextItems)) {
    if (!same(previousItems, nextItems)) {
      changes.push({
        kind: "retyped",
        path: itemsPath,
        previous: previousItems as unknown as Property,
        next: nextItems as unknown as Property
      });
    }
    return;
  }

  if (!previousItems && !nextItems) {
    return;
  }
  if (!previousItems) {
    changes.push({kind: "added", path: itemsPath, property: nextItems as Property});
  } else if (!nextItems) {
    changes.push({kind: "removed", path: itemsPath, property: previousItems as Property});
  } else {
    diffProperty(itemsPath, previousItems, nextItems, changes);
  }
}

function diffProperties(
  path: string[],
  previous: SchemaNode,
  next: SchemaNode,
  changes: FieldChange[]
) {
  const previousProperties = previous.properties ?? {};
  const nextProperties = next.properties ?? {};
  const previousRequired = new Set(previous.required ?? []);
  const nextRequired = new Set(next.required ?? []);

  for (const name of Object.keys(previousProperties)) {
    if (!(name in nextProperties)) {
      changes.push({kind: "removed", path: [...path, name], property: previousProperties[name]});
    }
  }

  for (const name of Object.keys(nextProperties)) {
    const fieldPath = [...path, name];
    if (!(name in previousProperties)) {
      changes.push({kind: "added", path: fieldPath, property: nextProperties[name]});
      continue;
    }
    diffProperty(fieldPath, previousProperties[name], nextProperties[name], changes);
    if (previousRequired.has(name) !== nextRequired.has(name)) {
      changes.push({kind: "required", path: fieldPath, required: nextRequired.has(name)});
    }
  }
}

// A renamed field is reported as a removal and an addition, because a rename cannot be told apart from them.
export function diffBuckets(previous: Bucket, next: Bucket): BucketDiff {
  const fields: FieldChange[] = [];
  diffProperties(
    [],
    {properties: previous.properties, required: previous.required},
    {properties: next.properties, required: next.required},
    fields
  );
  return {fields, indexes: diffIndexes(previous, next)};
}
