import {Entity, quote, ResolvedColumn} from "@spica-server/data-postgresql-orm";
import {Column, FieldResolver, InvalidRuleError, UnsupportedRuleError} from "../../access/index.js";

type ColumnType = Column["type"];
type Property = Column["property"];

const COLUMN_TYPES: Record<string, ColumnType> = {
  uuid: "uuid",
  text: "text",
  integer: "integer",
  bigint: "bigint",
  "double precision": "double precision",
  boolean: "boolean",
  timestamptz: "timestamptz",
  jsonb: "jsonb"
};

const PROPERTY_TYPES: Record<string, string> = {
  uuid: "uuid",
  text: "string",
  integer: "integer",
  bigint: "bigint",
  "double precision": "number",
  boolean: "boolean",
  timestamptz: "date",
  jsonb: "json"
};

const SECRET_NAMES = new Set(["password", "lastPasswords", "encrypted", "iv", "authTag", "secret"]);

const SECRET_PROPERTIES: Record<string, string[]> = {
  apikeys: ["key"],
  refresh_tokens: ["token"],
  verifications: ["code"]
};

export function isSecret(entity: Entity, column: ResolvedColumn): boolean {
  return (
    column.path.some(name => SECRET_NAMES.has(name)) ||
    (SECRET_PROPERTIES[entity.table] ?? []).includes(column.property)
  );
}

export class EntityFieldResolver implements FieldResolver {
  constructor(
    private readonly entity: Entity,
    private readonly alias: string
  ) {}

  locate(path: string[]): Column {
    const name = path.join(".");
    const column = this.entity.byProperty.get(name);
    if (!column) {
      throw new InvalidRuleError(`"${name}" is not a field of the collection.`);
    }
    if (isSecret(this.entity, column)) {
      throw new UnsupportedRuleError(`"${name}" cannot be used in a filter.`);
    }
    const type = COLUMN_TYPES[column.type];
    if (!type) {
      throw new UnsupportedRuleError(`"${name}" is a list and cannot be used in a filter.`);
    }
    return {
      kind: "column",
      sql: `${quote(this.alias)}.${quote(column.column)}`,
      type,
      property: {type: PROPERTY_TYPES[column.type]} as Property
    };
  }
}
