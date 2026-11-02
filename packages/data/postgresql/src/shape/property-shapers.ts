import {columnName, ColumnType, SYSTEM_COLUMNS, TableMetadata} from "../schema/index.js";
import {
  isArray,
  isStructuredObject,
  itemsOf,
  Property,
  relationTypeOf
} from "../schema/metadata/property.js";
import {fieldKey, Row, RowSet} from "./row-set.js";
import {BucketDescription, Scope, ShapeEnvironment} from "./scope.js";
import {byPosition, Document, isVacant, normalize} from "./values.js";

export interface PropertyVisit {
  scope: Scope;
  path: string[];
  property: Property;
}

export interface Shaping {
  environment: ShapeEnvironment;
  property(visit: PropertyVisit): unknown;
  object(scope: Scope, path: string[], properties: Record<string, Property>): Document;
  document(rowSet: RowSet, description: BucketDescription): Document;
}

export interface PropertyShaper {
  matches(visit: PropertyVisit): boolean;
  shape(visit: PropertyVisit, shaping: Shaping): unknown;
}

type Relation = Property & {bucketId: string};

const samePath = (a: string[], b: string[]) => a.length == b.length && a.every((s, i) => s == b[i]);

const tableAt = ({scope: {description}}: PropertyVisit, path: string[]): TableMetadata =>
  description.metadata.tables.find(table => samePath(table.path, path));

function columnOf({scope, path}: PropertyVisit) {
  const name = columnName(path.slice(scope.table.path.length));
  return scope.table.columns.find(column => column.name == name);
}

const rowsOf = ({scope}: PropertyVisit, path: string[]): Row[] =>
  scope.rowSet.children?.[fieldKey(path)] ?? [];

const keyTypeOf = (description: BucketDescription): ColumnType | undefined =>
  description.metadata.primaryKey.type == "bigint" ? "bigint" : undefined;

function joinedTargets(visit: PropertyVisit, target: BucketDescription) {
  const joined = visit.scope.rowSet.joined;
  const key = fieldKey(visit.path);
  if (!joined || !(key in joined)) {
    return undefined;
  }
  const value = joined[key];
  const list = value == null ? [] : Array.isArray(value) ? value : [value];
  const keyColumn = target.metadata.primaryKey.column;
  return new Map(list.map(set => [String(set.main[keyColumn]), set]));
}

const objectShaper: PropertyShaper = {
  matches: ({property}) => isStructuredObject(property),
  shape(visit, shaping) {
    const object = shaping.object(
      visit.scope,
      visit.path,
      visit.property.properties as Record<string, Property>
    );
    return isVacant(object) ? {} : object;
  }
};

const translatedShaper: PropertyShaper = {
  matches: ({property}) => Boolean(property.options?.translate),
  shape(visit, shaping) {
    const table = tableAt(visit, visit.path);
    const valueType = table.columns.find(column => column.name == SYSTEM_COLUMNS.value)?.type;
    const translations = Object.fromEntries(
      rowsOf(visit, visit.path).map(row => [
        String(row[SYSTEM_COLUMNS.locale]),
        normalize(row[SYSTEM_COLUMNS.value], valueType)
      ])
    );
    const {locale} = shaping.environment;
    if (!locale || visit.path.length > 1) {
      return translations;
    }
    return translations[locale.best] ?? translations[locale.fallback] ?? translations;
  }
};

const relationShaper: PropertyShaper = {
  matches: ({property}) => property.type == "relation",
  shape(visit, shaping) {
    const {scope, path} = visit;
    const target = shaping.environment.describe((visit.property as Relation).bucketId);
    const targets = joinedTargets(visit, target);
    const resolve = (key: unknown) => {
      const set = targets.get(String(key));
      return set ? shaping.document(set, target) : null;
    };

    if (relationTypeOf(visit.property) == "onetomany") {
      const keys = byPosition(rowsOf(visit, path), SYSTEM_COLUMNS.position).map(
        row => row[SYSTEM_COLUMNS.target]
      );
      return targets
        ? keys.filter(key => targets.has(String(key))).map(resolve)
        : keys.map(key => normalize(key, keyTypeOf(target)));
    }

    const key = scope.row[columnOf(visit).name];
    if (key === null || key === undefined) {
      return null;
    }
    return targets ? resolve(key) : normalize(key, keyTypeOf(target));
  }
};

const arrayShaper: PropertyShaper = {
  matches: ({property}) => isArray(property) && Boolean(itemsOf(property)),
  shape(visit, shaping) {
    const table = tableAt(visit, visit.path);
    const rows = byPosition(rowsOf(visit, visit.path), SYSTEM_COLUMNS.position);
    const items = itemsOf(visit.property);

    if (isStructuredObject(items)) {
      return rows.map(row => {
        const item = shaping.object(
          {...visit.scope, table, row},
          visit.path,
          items.properties as Record<string, Property>
        );
        return isVacant(item) ? {} : item;
      });
    }
    const valueType = table.columns.find(column => column.name == SYSTEM_COLUMNS.value)?.type;
    return rows.map(row => normalize(row[SYSTEM_COLUMNS.value], valueType));
  }
};

export const SCALAR_SHAPER: PropertyShaper = {
  matches: () => true,
  shape(visit) {
    const column = columnOf(visit);
    if (!column) {
      return null;
    }
    return normalize(
      visit.scope.row[column.name],
      column.type,
      (visit.property as {locationType?: string}).locationType
    );
  }
};

export const PROPERTY_SHAPERS: PropertyShaper[] = [
  objectShaper,
  translatedShaper,
  relationShaper,
  arrayShaper
];
