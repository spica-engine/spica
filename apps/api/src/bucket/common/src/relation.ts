import {BucketService, getBucketDataCollection} from "@spica-server/bucket/services";
import {ObjectId} from "@spica-server/database";
import {buildI18nAggregation} from "./locale";
import {deepCopy} from "@spica-server/core/patch";
import {setPropertyByPath} from "./schema";
import {
  Locale,
  RelationType,
  RelationMap,
  RelationMapOptions,
  ResetNonOverlappingPathsOptions,
  RelationDefinition,
  RelationResolver
} from "@spica-server/interface/bucket/common";
import {Bucket, BucketDocument} from "@spica-server/interface/bucket/services";

export function findRelations(
  schema: any,
  bucketId: string,
  path: string = "",
  targets: Map<string, RelationType>
) {
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

export function getRelationPipeline(map: RelationMap[], locale: Locale): object[] {
  const pipeline = [];

  for (const relation of map) {
    let subPipeline;

    if (relation.children) {
      subPipeline = getRelationPipeline(relation.children, locale);
    }

    const stage = buildRelationAggregation(
      relation.path,
      relation.target,
      relation.type,
      locale,
      subPipeline
    );

    pipeline.push(...stage);
  }

  return pipeline;
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

export function resetNonOverlappingPathsInRelationMap(
  options: ResetNonOverlappingPathsOptions
): object {
  const visit = ({
    left,
    right,
    map,
    depth
  }: ResetNonOverlappingPathsOptions & {
    depth: number;
  }): {[path: string]: object | string} => {
    let paths: {[path: string]: object | string} = {};
    let hasKeys = false;
    for (const relation of map) {
      const leftMatch = left.filter(segments => segments[depth] == relation.path);
      const rightMatch = right.filter(segments => segments[depth] == relation.path);

      if (!leftMatch.length && rightMatch.length) {
        hasKeys = true;

        const path = rightMatch[0].slice(0, depth + 1).join(".");

        if (relation.type == "onetoone") {
          paths[path] = {$toString: `$${path}._id`};
        } else {
          paths[path] = {
            $map: {
              input: `$${path}`,
              as: "doc",
              in: `$$doc._id`
            }
          };
        }
      } else if (relation.children) {
        const subPaths = visit({
          left: leftMatch,
          right: rightMatch,
          depth: depth + 1,
          map: relation.children
        });
        if (subPaths) {
          hasKeys = true;
          paths = {...paths, ...subPaths};
        }
      }
    }

    return hasKeys ? paths : undefined;
  };

  const expressions = visit({left: options.left, right: options.right, map: options.map, depth: 0});
  return expressions ? {$set: expressions} : undefined;
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

function assertRelationType(type: RelationType) {
  if (type != RelationType.One && type != RelationType.Many) {
    throw new Error(`unknown relation type ${type}`);
  }
}

export function getUpdateParams(
  target: string,
  type: RelationType,
  documentId: string
): {filter: object; update: object} {
  assertRelationType(type);

  if (type == RelationType.One) {
    return {filter: {[target]: documentId}, update: {$unset: {[target]: ""}}};
  } else if (type == RelationType.Many) {
    return {
      filter: {[target]: {$in: [documentId]}},
      update: {$pull: {[target]: documentId}}
    };
  }
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

export function buildRelationAggregation(
  property: string,
  bucketId: string,
  type: RelationType,
  locale: Locale,
  additionalPipeline?: object[]
): object[] {
  assertRelationType(type);
  const pipeline = [];

  let _let;

  if (type == RelationType.One) {
    _let = {
      documentId: {
        $toObjectId: `$${property}`
      }
    };
    pipeline.push({$match: {$expr: {$eq: ["$_id", "$$documentId"]}}});
  } else if (type == RelationType.Many) {
    _let = {
      documentIds: {
        $ifNull: [
          {
            $map: {
              input: `$${property}`,
              in: {$toObjectId: "$$this"}
            }
          },
          []
        ]
      }
    };
    pipeline.push({$match: {$expr: {$in: ["$_id", "$$documentIds"]}}});
  }

  if (additionalPipeline) {
    pipeline.push(...additionalPipeline);
  }

  if (locale) {
    pipeline.push({$replaceWith: buildI18nAggregation("$$ROOT", locale.best, locale.fallback)});
  }

  const lookup = {
    $lookup: {
      from: getBucketDataCollection(bucketId),
      as: property,
      let: _let,
      pipeline
    }
  };

  return type == RelationType.One
    ? [lookup, {$unwind: {path: `$${property}`, preserveNullAndEmptyArrays: true}}]
    : [lookup];
}

export async function clearRelations(
  bucketService: BucketService,
  bucketId: ObjectId,
  documentId: ObjectId
) {
  const buckets = await bucketService.find({_id: {$ne: bucketId}});

  for (const bucket of buckets) {
    const targets = findRelations(bucket.properties, bucketId.toString(), "", new Map());

    for (const [target, type] of targets.entries()) {
      const updateParams = getUpdateParams(target, type, documentId.toString());
      await bucketService
        .collection(`bucket_${bucket._id.toString()}`)
        .updateMany(updateParams.filter, updateParams.update);
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
