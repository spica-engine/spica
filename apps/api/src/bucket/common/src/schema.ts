export function getPropertyByPath(properties: object, path: string) {
  return accessPropertyFromPath(properties, path);
}

export function setPropertyByPath(properties: object, path: string, replaceWith: object) {
  return accessPropertyFromPath(properties, path, replaceWith);
}

function accessPropertyFromPath(properties: object, path: string, replaceWith?: object) {
  const segments = path.split(".");
  const key = segments[0];

  const isKeyOneOfProperties = !!properties[key];

  if (!isKeyOneOfProperties) {
    return undefined;
  }

  if (segments.length == 1) {
    if (replaceWith) {
      properties[key] = replaceWith;
    }

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
  return accessPropertyFromPath(subProperties, segmentsExceptFirstOne, replaceWith);
}
