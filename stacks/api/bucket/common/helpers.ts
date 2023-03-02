export function categorizePropertyMap(propertyMap: string[][]) {
  const documentPropertyMap: string[][] = [];
  const authPropertyMap: string[][] = [];

  propertyMap.forEach(pmap =>
    pmap[0] == "auth"
      ? authPropertyMap.push(pmap.slice(1))
      : documentPropertyMap.push(pmap.slice(1))
  );

  return {documentPropertyMap, authPropertyMap};
}

function getPropertyByPath(properties: object, path: string) {
  const segments = path.split(".");
  const key = segments[0];

  const isKeyOneOfProperties = !!properties[key];

  if (!isKeyOneOfProperties) {
    return undefined;
  }

  if (segments.length == 1) {
    return properties[key];
  }

  const isObject = properties[key].type == "object";
  const isObjectArray = properties[key].type == "array" && properties[key].items.type == "object";

  const subProperties = isObject
    ? properties[key].properties
    : isObjectArray
    ? properties[key].items.properties
    : undefined;

  if (!subProperties) {
    return undefined;
  }

  const segmentsExceptFirstOne = segments.slice(1).join(".");
  return getPropertyByPath(subProperties, segmentsExceptFirstOne);
}