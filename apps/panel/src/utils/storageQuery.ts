import type {DataEngine} from "../store/api/statusApi";
import type {FilterInput} from "./serializeFilter";

export type StorageClause =
  | {kind: "regex"; field: string; pattern: string; ignoreCase?: boolean; negate?: boolean}
  | {kind: "in"; field: string; values: string[]}
  | {kind: "equals"; field: string; value: string}
  | {kind: "notEqual"; field: string; value: string}
  | {kind: "range"; field: string; gte?: number | string; lte?: number | string}
  | {kind: "and"; clauses: StorageClause[]}
  | {kind: "or"; clauses: StorageClause[]};

export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const matchesName = (pattern: string, ignoreCase = false): StorageClause => ({
  kind: "regex",
  field: "name",
  pattern,
  ignoreCase
});

export const nameEndsWithSlash = (): StorageClause => ({
  kind: "regex",
  field: "name",
  pattern: "/$",
  negate: true
});

export const anyOf = (clauses: StorageClause[]): StorageClause => ({kind: "or", clauses});

export const allOf = (clauses: StorageClause[]): StorageClause | null =>
  clauses.length === 0 ? null : clauses.length === 1 ? clauses[0] : {kind: "and", clauses};

const mongoRange = (clause: Extract<StorageClause, {kind: "range"}>) => ({
  [clause.field]: {
    ...(clause.gte !== undefined ? {$gte: clause.gte} : {}),
    ...(clause.lte !== undefined ? {$lte: clause.lte} : {})
  }
});

function toMongo(clause: StorageClause): Record<string, unknown> {
  switch (clause.kind) {
    case "regex": {
      const matcher = {$regex: clause.pattern, ...(clause.ignoreCase ? {$options: "i"} : {})};
      return {[clause.field]: clause.negate ? {$not: matcher} : matcher};
    }
    case "in":
      return {[clause.field]: {$in: clause.values}};
    case "equals":
      return {[clause.field]: clause.value};
    case "notEqual":
      return {[clause.field]: {$ne: clause.value}};
    case "range":
      return mongoRange(clause);
    case "and":
      return {$and: clause.clauses.map(toMongo)};
    case "or":
      return {$or: clause.clauses.map(toMongo)};
  }
}

const quoted = (value: string | number): string => JSON.stringify(value);

function toExpression(clause: StorageClause): string {
  const path = (field: string) => `document.${field}`;
  switch (clause.kind) {
    case "regex": {
      const call = `regex(${path(clause.field)}, ${quoted(clause.pattern)}${clause.ignoreCase ? ', "i"' : ""})`;
      return clause.negate ? `!(${call})` : call;
    }
    case "in":
      return `${path(clause.field)} in [${clause.values.map(quoted).join(", ")}]`;
    case "equals":
      return `${path(clause.field)} == ${quoted(clause.value)}`;
    case "notEqual":
      return `${path(clause.field)} != ${quoted(clause.value)}`;
    case "range": {
      const parts = [
        ...(clause.gte !== undefined ? [`${path(clause.field)} >= ${quoted(clause.gte)}`] : []),
        ...(clause.lte !== undefined ? [`${path(clause.field)} <= ${quoted(clause.lte)}`] : [])
      ];
      return parts.length > 1 ? `(${parts.join(" && ")})` : parts[0];
    }
    case "and":
      return `(${clause.clauses.map(toExpression).join(" && ")})`;
    case "or":
      return `(${clause.clauses.map(toExpression).join(" || ")})`;
  }
}

export function compileStorageClause(
  engine: DataEngine | undefined,
  clause: StorageClause | null
): FilterInput | null {
  if (!clause) return null;
  return engine === "postgresql" ? toExpression(clause) : toMongo(clause);
}
