import {Bucket} from "@spica-server/interface-bucket";
import {
  childPropertiesOf,
  COLUMN_TYPE_OF_PROPERTY,
  isArray,
  isScalar,
  isStructuredObject,
  itemsOf,
  Property,
  relationTypeOf
} from "./property.js";

type Reason = string | undefined;

function translatedReason(property: Property, insideArray: boolean): Reason {
  if (insideArray) {
    return `translated ${property.type} inside an array`;
  }
  return COLUMN_TYPE_OF_PROPERTY[property.type as string]
    ? undefined
    : `translated ${property.type}`;
}

function relationReason(property: Property, insideArray: boolean): Reason {
  return insideArray && relationTypeOf(property) == "onetomany"
    ? "onetomany relation inside an array"
    : undefined;
}

function arrayReason(property: Property, insideArray: boolean): Reason {
  if (insideArray) {
    return `nested ${property.type}`;
  }
  const items = itemsOf(property);
  if (!items) {
    return undefined;
  }
  if (items.type == "relation") {
    return `${property.type} of relation`;
  }
  const reason = unsupportedReason(items, true);
  return reason && (isStructuredObject(items) ? reason : `${property.type} of ${reason}`);
}

function objectReason(property: Property, insideArray: boolean): Reason {
  for (const child of Object.values(property.properties)) {
    const reason = unsupportedReason(child as Property, insideArray);
    if (reason) {
      return reason;
    }
  }
  return undefined;
}

export function unsupportedReason(property: Property, insideArray: boolean): Reason {
  if (property.options?.translate) {
    return translatedReason(property, insideArray);
  }
  if (property.type == "relation") {
    return relationReason(property, insideArray);
  }
  if (isArray(property)) {
    return arrayReason(property, insideArray);
  }
  if (isStructuredObject(property)) {
    return objectReason(property, insideArray);
  }
  return isScalar(property) ? undefined : (property.type as string);
}

function listUnsupported(properties: Record<string, Property>, prefix: string[]): string[] {
  return Object.entries(properties).flatMap(([field, property]) => {
    const path = [...prefix, field];
    const reason = unsupportedReason(property, false);
    if (reason) {
      return [`${path.join(".")} (${reason})`];
    }
    const children = childPropertiesOf(property);
    return children ? listUnsupported(children, path) : [];
  });
}

export function propertyProblems(bucket: Bucket): string[] {
  const unsupported = listUnsupported((bucket.properties ?? {}) as Record<string, Property>, []);
  return unsupported.length
    ? [`Properties are not supported on PostgreSQL yet: ${unsupported.join(", ")}.`]
    : [];
}
