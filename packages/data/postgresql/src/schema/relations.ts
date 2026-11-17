import {Bucket} from "@spica-server/interface-bucket";

type Property = NonNullable<Bucket["properties"]>[string] & {bucketId?: string};

const isRelation = (property: Property) => property.type == "relation";

export function relationTargets(properties: Bucket["properties"] = {}): string[] {
  const found = new Set<string>();
  const visit = (current: Record<string, Property>) => {
    for (const property of Object.values(current)) {
      if (isRelation(property) && property.bucketId) {
        found.add(property.bucketId);
      }
      const items = property.items as Property | undefined;
      const children = property.properties ?? (items && !Array.isArray(items) && items.properties);
      if (children) {
        visit(children as Record<string, Property>);
      }
    }
  };
  visit(properties as Record<string, Property>);
  return [...found];
}

interface Pruned {
  properties: Record<string, Property>;
  removed: string[][];
}

function pruneProperties(
  properties: Record<string, Property>,
  targetId: string,
  path: string[]
): Pruned {
  const kept: Record<string, Property> = {};
  const removed: string[][] = [];

  for (const [name, property] of Object.entries(properties)) {
    if (isRelation(property) && property.bucketId == targetId) {
      removed.push([...path, name]);
      continue;
    }

    const items = property.items as Property | undefined;
    const holder = property.properties ? property : items && !Array.isArray(items) ? items : null;
    if (!holder?.properties) {
      kept[name] = property;
      continue;
    }

    const inner = pruneProperties(holder.properties as Record<string, Property>, targetId, [
      ...path,
      name
    ]);
    removed.push(...inner.removed);
    if (!inner.removed.length) {
      kept[name] = property;
      continue;
    }

    const required = holder.required?.filter(field => inner.properties[field]);
    const pruned = {...holder, properties: inner.properties, ...(required ? {required} : {})};
    kept[name] = holder === property ? pruned : {...property, items: pruned};
  }
  return {properties: kept, removed};
}

export function withoutRelationsTo(bucket: Bucket, targetId: string): Bucket | null {
  const {properties, removed} = pruneProperties(
    (bucket.properties ?? {}) as Record<string, Property>,
    targetId,
    []
  );
  if (!removed.length) {
    return null;
  }

  const isRemoved = (field: string) => {
    const path = field.split(".");
    return removed.some(gone => gone.every((segment, index) => path[index] == segment));
  };

  return {
    ...bucket,
    properties,
    ...(bucket.required ? {required: bucket.required.filter(field => properties[field])} : {}),
    ...(bucket.indexes
      ? {
          indexes: bucket.indexes.filter(
            index => !Object.keys(index.definition).some(field => isRemoved(field))
          )
        }
      : {})
  };
}
