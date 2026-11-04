import {Bucket} from "@spica-server/interface-bucket";
import {ColumnType} from "./types.js";

export type Property = NonNullable<Bucket["properties"]>[string];

export const COLUMN_TYPE_OF_PROPERTY: Record<string, ColumnType> = {
  string: "text",
  textarea: "text",
  richtext: "text",
  color: "text",
  storage: "text",
  hash: "text",
  encrypted: "text",
  number: "double precision",
  boolean: "boolean",
  date: "timestamptz",
  json: "jsonb",
  location: "point",
  uuid: "uuid",
  integer: "integer",
  bigint: "bigint"
};

export const relationTypeOf = (property: Property) =>
  (property as {relationType?: string}).relationType;

export const isArray = (property: Property) =>
  property.type == "array" || property.type == "multiselect";

export const isStructuredObject = (property: Property) =>
  property.type == "object" && Boolean(property.properties);

export function itemsOf(property: Property): Property | undefined {
  const items = property.items as Property | Property[] | undefined;
  return items && !Array.isArray(items) ? items : undefined;
}

export function childPropertiesOf(property: Property): Record<string, Property> | undefined {
  if (isStructuredObject(property)) {
    return property.properties as Record<string, Property>;
  }
  const items = isArray(property) ? itemsOf(property) : undefined;
  return items && isStructuredObject(items)
    ? (items.properties as Record<string, Property>)
    : undefined;
}

export const enumOf = (source: Property) => (source.enum?.length ? {enum: [...source.enum]} : {});

export const isScalar = (property: Property) =>
  property.type == "object" || Boolean(COLUMN_TYPE_OF_PROPERTY[property.type as string]);

export const columnTypeOf = (property: Property): ColumnType =>
  isStructuredObject(property) || isArray(property) || property.type == "object"
    ? "jsonb"
    : COLUMN_TYPE_OF_PROPERTY[property.type as string];
