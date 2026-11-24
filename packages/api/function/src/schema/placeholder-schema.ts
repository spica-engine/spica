import {WHOLE_PLACEHOLDER_PATTERN} from "../placeholder/placeholder-text.js";

const NON_STRING_SCALARS = ["number", "integer", "boolean"];

export function allowPlaceholders<T extends object>(schema: T): T {
  return visit(schema) as T;
}

function visit(node: any): any {
  if (Array.isArray(node)) {
    return node.map(visit);
  }
  if (node === null || typeof node != "object") {
    return node;
  }
  const visited = Object.fromEntries(Object.entries(node).map(([k, v]) => [k, visitChild(k, v)]));
  return visited;
}

function visitChild(keyword: string, value: any) {
  if (keyword == "properties" && value && typeof value == "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, relax(visit(v))]));
  }
  return visit(value);
}

function relax(property: any) {
  if (!property || !NON_STRING_SCALARS.includes(property.type) || "enum" in property) {
    return property;
  }
  return {...property, type: [property.type, "string"], pattern: WHOLE_PLACEHOLDER_PATTERN};
}
