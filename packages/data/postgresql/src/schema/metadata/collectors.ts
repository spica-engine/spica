import {columnName, fieldTableName, SYSTEM_COLUMNS} from "../naming.js";
import {PrimaryKeyMetadata} from "../primary-key.js";
import {
  columnTypeOf,
  COLUMN_TYPE_OF_PROPERTY,
  enumOf,
  isArray,
  isStructuredObject,
  itemsOf,
  Property
} from "./property.js";
import {TableBuilder} from "./table-builder.js";
import {RelationTarget} from "./types.js";

export interface PropertyVisit {
  table: TableBuilder;
  path: string[];
  property: Property;
  required: boolean;
  insideArray: boolean;
}

export interface CollectionContext {
  bucketId: string;
  primaryKey: PrimaryKeyMetadata;
  targetOf(path: string[], targetId: string): RelationTarget;
  addTable(table: TableBuilder): void;
  visit(visit: PropertyVisit): void;
}

export interface PropertyCollector {
  matches(visit: PropertyVisit): boolean;
  collect(visit: PropertyVisit, context: CollectionContext): void;
}

const relativePath = ({table, path}: PropertyVisit) => path.slice(table.path.length);

const objectCollector: PropertyCollector = {
  matches: ({property}) => isStructuredObject(property),
  collect({table, path, property, required, insideArray}, context) {
    const requiredChildren = new Set(property.required ?? []);
    for (const [name, child] of Object.entries(property.properties)) {
      context.visit({
        table,
        path: [...path, name],
        property: child as Property,
        required: (insideArray || required) && requiredChildren.has(name),
        insideArray
      });
    }
  }
};

const translatedCollector: PropertyCollector = {
  matches: ({property}) => Boolean(property.options?.translate),
  collect({path, property}, context) {
    const translations = new TableBuilder(fieldTableName(context.bucketId, path), path, "locale");
    context.addTable(translations);
    translations.add({name: SYSTEM_COLUMNS.locale, path, type: "text", notNull: true});
    translations.add({
      name: SYSTEM_COLUMNS.value,
      path,
      type: COLUMN_TYPE_OF_PROPERTY[property.type as string],
      notNull: true,
      ...enumOf(property)
    });
  }
};

const relationCollector: PropertyCollector = {
  matches: ({property}) => property.type == "relation",
  collect(visit, context) {
    const {table, path, property, required} = visit;
    const relation = property as Property & {bucketId: string; relationType: string};
    const target = context.targetOf(path, relation.bucketId);

    if (relation.relationType == "onetomany") {
      const link = new TableBuilder(fieldTableName(context.bucketId, path), path);
      context.addTable(link);
      link.add({name: SYSTEM_COLUMNS.target, path, type: target.primaryKey.type, notNull: true});
      link.reference(SYSTEM_COLUMNS.target, target, "CASCADE");
      return;
    }

    const name = columnName(relativePath(visit));
    table.add({name, path, type: target.primaryKey.type, notNull: required});
    table.reference(name, target, required ? "RESTRICT" : "SET NULL");
  }
};

const arrayCollector: PropertyCollector = {
  matches: ({property, insideArray}) =>
    isArray(property) && !insideArray && Boolean(itemsOf(property)),
  collect({path, property}, context) {
    const items = itemsOf(property);
    const child = new TableBuilder(fieldTableName(context.bucketId, path), path);
    context.addTable(child);

    if (isStructuredObject(items)) {
      context.visit({table: child, path, property: items, required: true, insideArray: true});
      return;
    }
    child.add({
      name: SYSTEM_COLUMNS.value,
      path,
      type: COLUMN_TYPE_OF_PROPERTY[items.type as string] ?? "jsonb",
      notNull: true,
      ...enumOf(items)
    });
  }
};

const scalarCollector: PropertyCollector = {
  matches: () => true,
  collect(visit) {
    const {table, path, property, required} = visit;
    table.add({
      name: columnName(relativePath(visit)),
      path,
      type: columnTypeOf(property),
      notNull: required,
      ...enumOf(property)
    });
  }
};

export const COLLECTORS: PropertyCollector[] = [
  objectCollector,
  translatedCollector,
  relationCollector,
  arrayCollector,
  scalarCollector
];
