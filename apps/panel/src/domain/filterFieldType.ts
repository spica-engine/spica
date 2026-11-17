import type {FilterFieldType} from "../components/prefabs/filter-panel/types";

const TEXT_TYPES = new Set(["string", "textarea", "color", "richtext", "hash", "encrypted"]);

export function filterFieldTypeOf(property: {type?: string; items?: {enum?: unknown}}): FilterFieldType {
  const type = property?.type;
  if (type === "relation") return "relation";
  if (type && TEXT_TYPES.has(type)) return "string";
  if (type === "number" || type === "integer") return "number";
  if (type === "bigint") return "bigint";
  if (type === "uuid") return "id";
  if (type === "date") return "date";
  if (type === "boolean") return "boolean";
  if (type === "multiselect" && property.items?.enum) return "enum";
  return "string";
}
