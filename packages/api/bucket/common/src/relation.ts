import {BucketService, bucketIds} from "@spica-server/bucket-services";
import {Id} from "@spica-server/interface-data";
import {deepCopy} from "@spica-server/core-patch";
import {setPropertyByPath} from "./schema.js";
import {
  RelationType,
  RelationMap,
  RelationMapOptions,
  RelationDefinition,
  RelationResolver
} from "@spica-server/interface-bucket-common";
import {Bucket, BucketDataRepository, BucketDocument} from "@spica-server/interface-bucket";

export function findRelations(
  schema: any,
  bucketId: string,
  path: string = "",
  targets: Map<string, RelationType>
) {
  if (!schema) {
    return targets;
  }
  path = path ? `${path}.` : ``;
  for (const field of Object.keys(schema)) {
    if (isObject(schema[field])) {
      findRelations(schema[field].properties, bucketId, `${path}${field}`, targets);
    } else if (isDesiredRelation(schema[field], bucketId)) {
      targets.set(`${path}${field}`, schema[field].relationType);
    }
  }
  return targets;
}

export function getRelationPaths(target: Bucket | string[]) {
  if (Array.isArray(target)) {
    return target.map(pattern => pattern.split(".").concat(["_id"]));
  }

  const relationPaths = [];
  for (const propertyKey in target.properties) {
    if (target.properties[propertyKey].type != "relation") {
      continue;
    }
    relationPaths.push([propertyKey, "_id"]);
  }
  return relationPaths;
}

export async function getRelationResolvedBucketSchema(
  bucket: Bucket,
  paths: string[][],
  resolve: RelationResolver
): Promise<Bucket> {
  const copy = deepCopy(bucket);
  const relationMaps = await createRelationMap({properties: copy.properties, paths, resolve});
  const replaceWithRelatedBucket = (relationMap: RelationMap, properties: object) => {
    let replaceWith: any = {type: "object", properties: relationMap.schema.properties};
    if (relationMap.type == RelationType.Many) {
      replaceWith = {type: "array", items: replaceWith};
    }

    const setProperty = setPropertyByPath(properties, relationMap.path, replaceWith);

    if (relationMap.children) {
      for (let child of relationMap.children) {
        replaceWithRelatedBucket(child, setProperty.properties);
      }
    }
  };

  for (let relationMap of relationMaps) {
    replaceWithRelatedBucket(relationMap, copy.properties);
  }

  return copy;
}

export async function createRelationMap(options: RelationMapOptions): Promise<RelationMap[]> {
  const visit = async (
    properties: object,
    paths: string[][],
    depth: number,
    prefix?: string
  ): Promise<RelationMap[]> => {
    const maps: RelationMap[] = [];

    for (const [propertyKey, propertySpec] of Object.entries(properties)) {
      const matchingPaths = paths.filter(
        segments =>
          segments[depth] == propertyKey &&
          // if child field of this document requested
          segments.length > depth + 1
      );

      if (!matchingPaths.length) {
        continue;
      }

      if (propertySpec.type == "object") {
        const objectRelations = await visit(
          propertySpec.properties,
          matchingPaths,
          depth + 1,
          prefix ? prefix + "." + propertyKey : propertyKey
        );
        maps.push(...objectRelations);
        continue;
      }

      if (propertySpec.type != "relation") {
        continue;
      }

      const schema = await options.resolve(propertySpec.bucketId);

      const children = await visit(schema.properties, matchingPaths, depth + 1);

      const path = prefix ? prefix + "." + propertyKey : propertyKey;

      maps.push({
        path,
        target: propertySpec.bucketId,
        type: propertySpec.relationType,
        children: children.length ? children : undefined,
        schema
      });
    }

    return maps;
  };

  return visit(options.properties, options.paths, 0);
}

export function compareAndUpdateRelations(relationMap: RelationMap[], usedRelations: string[]) {
  const updatedRelationMap: RelationMap[] = [];

  for (const map of relationMap) {
    if (!usedRelations.includes(map.path)) {
      const paths = createRelationPaths(deepCopy(map));
      usedRelations.push(...paths);
      updatedRelationMap.push(map);
      continue;
    }

    if (map.children && map.children.length) {
      for (const child of map.children) {
        child.path = map.path + "." + child.path;
      }
      const updatedChilds = compareAndUpdateRelations(map.children, usedRelations);
      updatedRelationMap.push(...updatedChilds);
    }
  }
  return updatedRelationMap;
}

function createRelationPaths(relationMap: RelationMap): string[] {
  const paths = [];
  paths.push(relationMap.path);

  if (relationMap.children && relationMap.children.length) {
    for (const childMap of relationMap.children) {
      childMap.path = relationMap.path + "." + childMap.path;
      const path = createRelationPaths(childMap);
      paths.push(...path);
    }
  }

  return paths;
}

export function isObject(schema: any) {
  return schema.type == "object";
}

export function isRelation(schema: any): schema is RelationDefinition {
  return schema.type == "relation";
}

export function isDesiredRelation(schema: any, bucketId: string) {
  return isRelation(schema) && schema.bucketId == bucketId;
}

export function isArray(schema: any) {
  return schema.type == "array";
}

export function hasRelationChanges(previousSchema: any, currentSchema: any) {
  if (isRelation(previousSchema) && isRelation(currentSchema)) {
    return (
      previousSchema.relationType != currentSchema.relationType ||
      previousSchema.bucketId != currentSchema.bucketId
    );
  }

  return false;
}

export async function clearRelations(
  bucketService: BucketService,
  bucketData: BucketDataRepository,
  bucketId: Id,
  documentId: Id
) {
  const buckets = (await bucketService.findAll()).filter(
    bucket => !bucketIds().equals(bucket._id, bucketId)
  );

  for (const bucket of buckets) {
    const targets = findRelations(bucket.properties, bucketId.toString(), "", new Map());

    for (const [target, type] of targets.entries()) {
      await bucketData.clearRelation(bucket, target, type, documentId.toString());
    }
  }
}

export function getDependents(schema: Bucket, deletedDocument: BucketDocument) {
  const dependents: Map<string, string[]> = new Map();

  for (const [name, definition] of Object.entries(schema.properties)) {
    if (isRelation(definition) && definition.dependent && deletedDocument[name]) {
      const relatedBucketId = definition.bucketId;

      const relatedDocumentIds: string[] =
        definition.relationType == RelationType.One
          ? [deletedDocument[name]]
          : deletedDocument[name];

      // user can define more than one field which have same relations
      const existingIds = dependents.has(relatedBucketId) ? dependents.get(relatedBucketId) : [];
      const targetDocumentIds = new Set(existingIds.concat(relatedDocumentIds));
      dependents.set(relatedBucketId, Array.from(targetDocumentIds));
    }
  }

  return dependents;
}
