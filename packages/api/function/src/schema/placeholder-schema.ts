import {WHOLE_PLACEHOLDER_PATTERN} from "../placeholder/placeholder-text.js";

const NON_STRING_SCALARS = ["number", "integer", "boolean"];
const HOISTED_KEYWORDS = ["default", "description", "title"];

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
  if (!property || !NON_STRING_SCALARS.includes(property.type)) {
    return property;
  }
  const hoisted = Object.fromEntries(
    HOISTED_KEYWORDS.filter(k => k in property).map(k => [k, property[k]])
  );
  const inner = Object.fromEntries(Object.entries(property).filter(([k]) => !(k in hoisted)));
  return {
    ...hoisted,
    oneOf: [inner, {type: "string", pattern: WHOLE_PLACEHOLDER_PATTERN}]
  };
}
