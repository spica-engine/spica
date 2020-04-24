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

export function isObject(schema: any) {
  return schema &&
    schema.type == "object" &&
    schema.properties &&
    Object.keys(schema.properties).length > 0
    ? true
    : false;
}

export function isRelation(schema: any, bucketId: string) {
  return schema && schema.type == "relation" && schema.bucketId == bucketId ? true : false;
}
