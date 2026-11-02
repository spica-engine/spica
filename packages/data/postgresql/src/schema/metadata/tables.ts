import {Bucket} from "@spica-server/interface-bucket";
import {BucketSchemaError, mainTableName} from "../naming.js";
import {PrimaryKeyMetadata} from "../primary-key.js";
import {CollectionContext, COLLECTORS, PropertyVisit} from "./collectors.js";
import {enumOf, Property} from "./property.js";
import {TableBuilder} from "./table-builder.js";
import {RelationTarget, RelationTargets, TableMetadata} from "./types.js";

function collectionContext(
  bucketId: string,
  primaryKey: PrimaryKeyMetadata,
  targets: RelationTargets,
  children: TableBuilder[]
): CollectionContext {
  const mainName = mainTableName(bucketId);

  const context: CollectionContext = {
    bucketId,
    primaryKey,
    targetOf(path: string[], targetId: string): RelationTarget {
      const target = targetId == bucketId ? {table: mainName, primaryKey} : targets(targetId);
      if (!target) {
        throw new BucketSchemaError([
          `Relation "${path.join(".")}" refers to the bucket "${targetId}", which does not exist.`
        ]);
      }
      return target;
    },
    addTable: table => children.push(table),
    visit: (visit: PropertyVisit) => {
      COLLECTORS.find(collector => collector.matches(visit)).collect(visit, context);
    }
  };
  return context;
}

function addKeyColumn(main: TableBuilder, primaryKey: PrimaryKeyMetadata, property: Property) {
  main.add({
    name: primaryKey.column,
    path: [primaryKey.field],
    type: primaryKey.type,
    notNull: true,
    ...enumOf(property)
  });
}

export function describeTables(
  bucketId: string,
  bucket: Bucket,
  primaryKey: PrimaryKeyMetadata,
  targets: RelationTargets
): TableMetadata[] {
  const main = new TableBuilder(mainTableName(bucketId), []);
  const children: TableBuilder[] = [];
  const context = collectionContext(bucketId, primaryKey, targets, children);
  const requiredAtTop = new Set(bucket.required ?? []);

  for (const [field, property] of Object.entries(bucket.properties ?? {})) {
    if (field == primaryKey.field) {
      addKeyColumn(main, primaryKey, property as Property);
    } else {
      context.visit({
        table: main,
        path: [field],
        property: property as Property,
        required: requiredAtTop.has(field),
        insideArray: false
      });
    }
  }

  return [
    main.buildMain(primaryKey),
    ...children.map(child => child.buildChild(main.name, primaryKey))
  ];
}
