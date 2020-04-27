export function findRelations(schema: any, bucketId: string, path: string = "", targets: string[]) {
  path = path ? `${path}.` : ``;
  for (const key of Object.keys(schema)) {
    if (isObject(schema[key])) {
      findRelations(schema[key].properties, bucketId, `${path}${key}`, targets);
    } else if (isRelation(schema[key], bucketId)) {
      targets.push(`${path}${key}`);
    }
  }
  return targets;
}

export function findRemovedKeys(
  previousSchema: any,
  currentSchema: any,
  removedKeys: string[],
  path: string
) {
  for (const key of Object.keys(previousSchema)) {
    if (!currentSchema.hasOwnProperty(key)) {
      removedKeys.push(path ? `${path}.${key}` : key);
      //we dont need to check child keys of this key anymore
      continue;
    }
    if (isObject(previousSchema[key]) && isObject(currentSchema[key])) {
      findRemovedKeys(
        previousSchema[key].properties,
        currentSchema[key].properties,
        removedKeys,
        path ? `${path}.${key}` : key
      );
    } else if (isArray(previousSchema[key]) && isArray(currentSchema[key])) {
      addArrayPattern(
        previousSchema[key].items,
        currentSchema[key].items,
        removedKeys,
        path ? `${path}.${key}` : key
      );
    }
  }
  return removedKeys;
}

export function addArrayPattern(
  previousSchema: any,
  currentSchema: any,
  removedKeys: string[],
  path: string
) {
  path = `${path}.$[]`;
  if (isArray(previousSchema) && isArray(currentSchema)) {
    addArrayPattern(previousSchema.items, currentSchema.items, removedKeys, path);
  } else if (isObject(previousSchema) && isObject(currentSchema)) {
    findRemovedKeys(previousSchema.properties, currentSchema.properties, removedKeys, path);
  }
}

export function isObject(schema: any) {
  return schema.type == "object";
}

export function isRelation(schema: any, bucketId: string) {
  return schema.type == "relation" && schema.bucketId == bucketId;
}

export function isArray(schema: any) {
  return schema.type == "array";
}
