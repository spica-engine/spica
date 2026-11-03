import {createHash} from "node:crypto";
import {Bucket} from "@spica-server/interface-bucket";
import {quote} from "@spica-server/data-postgresql-orm";
import {SYSTEM_COLUMNS} from "../../schema/naming.js";
import {BucketMetadata, ColumnMetadata} from "../../schema/metadata/types.js";
import {InvalidRuleError, UnsupportedRuleError} from "./errors.js";
import {Column, Property} from "./operands.js";

export interface Related {
  bucket: Bucket;
  metadata: BucketMetadata;
}

export type RelatedBuckets = (bucketId: string) => Related | undefined;

export interface RuleScope {
  bucket: Bucket;
  metadata: BucketMetadata;
  auth: unknown;
  hashSecret?: string;
  table?: string;
  now?: () => number;
  related?: RelatedBuckets;
}

export interface ArrayField {
  kind: "array";
  name: string;
  table: string;
  element: ColumnMetadata;
  parent: string;
  via?: {table: string; key: string};
}

interface Frame extends Related {
  alias: string;
  trail: string[];
}

export function relationAlias(trail: string[]) {
  return `_r${createHash("sha256").update(trail.join("\0")).digest("hex").slice(0, 12)}`;
}

export class Joins {
  private readonly entries: {alias: string; sql: string}[] = [];

  add(alias: string, sql: string) {
    if (!this.entries.some(entry => entry.alias == alias)) {
      this.entries.push({alias, sql});
    }
  }

  // A join that folding made unnecessary is left out, together with the joins only it relied on.
  usedBy(sql: string): string[] {
    const kept = new Set<string>();
    let changed = true;
    while (changed) {
      changed = false;
      for (const {alias} of this.entries) {
        const reference = quote(alias);
        const used =
          !kept.has(alias) &&
          (sql.includes(reference) ||
            this.entries.some(other => kept.has(other.alias) && other.sql.includes(reference)));
        if (used) {
          kept.add(alias);
          changed = true;
        }
      }
    }
    return this.entries.filter(({alias}) => kept.has(alias)).map(({sql: join}) => join);
  }
}

function propertyIn(bucket: Bucket, path: string[]): Property | undefined {
  let properties = bucket.properties as Record<string, Property> | undefined;
  for (const [index, segment] of path.entries()) {
    const property = properties?.[segment];
    if (!property || index == path.length - 1) {
      return property;
    }
    if (property.type != "object") {
      return undefined;
    }
    properties = property.properties as typeof properties;
  }
  return undefined;
}

function leaf(frame: Frame, path: string[], property: Property, name: string): Column | ArrayField {
  // Encrypted values have no comparable column until Part 9 stores a hash (docs/postgresql/09-writes.md).
  if (property.type == "encrypted") {
    throw new UnsupportedRuleError(
      `"${name}" is encrypted and cannot be used in a rule on PostgreSQL.`
    );
  }

  const column = frame.metadata.columnOf(path);
  if (!column) {
    throw new UnsupportedRuleError(`"${name}" cannot be used in a rule on PostgreSQL.`);
  }

  const {main, children, primaryKey} = frame.metadata;
  if (column.table == main.name) {
    return {
      kind: "column",
      sql: `${quote(frame.alias)}.${quote(column.name)}`,
      type: column.type,
      property
    };
  }

  const child = children.find(candidate => candidate.name == column.table);
  if (!child || child.keyColumns.includes(SYSTEM_COLUMNS.locale) || column.type == "point") {
    throw new UnsupportedRuleError(`"${name}" cannot be used in a rule on PostgreSQL.`);
  }
  return {
    kind: "array",
    name,
    table: child.name,
    element: column,
    parent: `${quote(frame.alias)}.${quote(primaryKey.column)}`
  };
}

function relatedOf(property: Property, scope: RuleScope): Related {
  const id = (property as unknown as {bucketId: string}).bucketId;
  const related = scope.related?.(id);
  if (!related) {
    throw new UnsupportedRuleError(`The related bucket "${id}" is not available to the rule.`);
  }
  return related;
}

function throughOneToMany(
  frame: Frame,
  path: string[],
  property: Property,
  rest: string[],
  name: string,
  scope: RuleScope
): ArrayField {
  const list = leaf(frame, path, property, name);
  if (list.kind != "array") {
    throw new UnsupportedRuleError(`"${name}" cannot be used in a rule on PostgreSQL.`);
  }
  const target = relatedOf(property, scope);
  if (rest.length == 1 && rest[0] == target.metadata.primaryKey.field) {
    return list;
  }

  const value = propertyIn(target.bucket, rest);
  if (!value || value.type == "relation") {
    throw new UnsupportedRuleError(
      `"${name}" has to name a field of the related bucket, not a relation of it, on PostgreSQL.`
    );
  }
  // Encrypted values have no comparable column until Part 9 stores a hash (docs/postgresql/09-writes.md).
  if (value.type == "encrypted") {
    throw new UnsupportedRuleError(
      `"${name}" is encrypted and cannot be used in a rule on PostgreSQL.`
    );
  }
  const element = target.metadata.columnOf(rest);
  if (!element || element.table != target.metadata.main.name) {
    throw new UnsupportedRuleError(`"${name}" cannot be used in a rule on PostgreSQL.`);
  }
  return {
    ...list,
    element,
    via: {table: target.metadata.main.name, key: target.metadata.primaryKey.column}
  };
}

export function locate(path: string[], scope: RuleScope, joins: Joins): Column | ArrayField {
  const name = path.join(".");
  let frame: Frame = {
    bucket: scope.bucket,
    metadata: scope.metadata,
    alias: scope.table ?? scope.metadata.main.name,
    trail: []
  };
  let local: string[] = [];

  for (const [index, segment] of path.entries()) {
    local = [...local, segment];
    const property = propertyIn(frame.bucket, local);
    if (!property) {
      throw new InvalidRuleError(`"${name}" is not a property of the bucket.`);
    }
    const rest = path.slice(index + 1);
    if (!rest.length) {
      return leaf(frame, local, property, name);
    }
    if (property.type != "relation") {
      continue;
    }

    if ((property as {relationType?: string}).relationType == "onetomany") {
      return throughOneToMany(frame, local, property, rest, name, scope);
    }

    const target = relatedOf(property, scope);
    const key = leaf(frame, local, property, name);
    if (key.kind != "column") {
      throw new UnsupportedRuleError(`"${name}" cannot be used in a rule on PostgreSQL.`);
    }
    if (rest.length == 1 && rest[0] == target.metadata.primaryKey.field) {
      return {...key, property: propertyIn(target.bucket, rest)!};
    }

    const trail = [...frame.trail, ...local];
    const alias = relationAlias(trail);
    joins.add(
      alias,
      `LEFT JOIN ${quote(target.metadata.main.name)} AS ${quote(alias)} ON ${quote(alias)}.${quote(target.metadata.primaryKey.column)} = ${key.sql}`
    );
    frame = {...target, alias, trail};
    local = [];
  }
  throw new InvalidRuleError(`"${name}" is not a property of the bucket.`);
}

export function resolveField(path: string[], scope: RuleScope, joins: Joins): Column {
  const field = locate(path, scope, joins);
  if (field.kind == "array") {
    throw new UnsupportedRuleError(
      `"${field.name}" is a list. Use has, length, some, every or equal on it.`
    );
  }
  return field;
}

export function childRows(field: ArrayField, alias: string) {
  const row = quote(alias);
  const joined = field.via
    ? ` JOIN ${quote(field.via.table)} AS ${quote(`${alias}_t`)} ON ${quote(`${alias}_t`)}.${quote(field.via.key)} = ${row}.${quote(SYSTEM_COLUMNS.target)}`
    : "";
  return `FROM ${quote(field.table)} AS ${row}${joined} WHERE ${row}.${quote(SYSTEM_COLUMNS.parent)} = ${field.parent}`;
}

export function elementColumn(field: ArrayField, alias: string) {
  return `${quote(field.via ? `${alias}_t` : alias)}.${quote(field.element.name)}`;
}
