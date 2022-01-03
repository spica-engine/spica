import {
  Bucket,
  BucketService,
  getBucketDataCollection,
  BucketDocument
} from "@spica-server/bucket/services";
import {ObjectId} from "@spica-server/database";
import {buildI18nAggregation, Locale} from "./locale";
import {deepCopy} from "./patch";

export function findRelations(
  schema: any,
  bucketId: string,
  path: string = "",
  targets: Map<string, RelationType>,
  findArrays = false
) {
  path = path ? `${path}.` : ``;
  for (const [name, spec] of Object.entries(schema) as any) {
    if (isObject(spec)) {
      findRelations(spec.properties, bucketId, `${path}${name}`, targets, findArrays);
      // revert these changes;
    } else if (findArrays && isArray(spec)) {
      findRelations(spec.items.properties || {}, bucketId, `${path}[${name}]`, targets, findArrays);
    } else if (isDesiredRelation(spec, bucketId)) {
      targets.set(`${path}${name}`, spec.relationType);
    }
  }
  return targets;
}

export function getRelationPaths(target: Bucket | string[]) {
  if (Array.isArray(target)) {
    return target.map(pattern => pattern.split("."));
  }

  const relationPaths = [];
  for (const propertyKey in target.properties) {
    if (target.properties[propertyKey].type != "relation") {
      continue;
    }
    relationPaths.push([propertyKey]);
  }
  return relationPaths;
}

export function visitPaths(path: RelationPath) {
  const res = path.type == "array" ? `[${path.field}]` : path.field;
  if (!path.children) {
    return res;
  }
  return `${res}.${visitPaths(path.children)}`;
}

export function createPathFromRelationMap(map: RelationMap) {
  if (map.path) {
    return `${visitPaths(map.path)}.${map.field}`;
  }

  return map.field;
}

export function getRelationPipeline(map: RelationMap[], locale: Locale): object[] {
  const pipeline = [];

  for (const relation of map) {
    const path = createPathFromRelationMap(relation);
    let subPipeline;

    if (relation.children) {
      subPipeline = getRelationPipeline(relation.children, locale);
    }

    const stage = buildRelationAggregation(
      path,
      relation.target,
      relation.type,
      locale,
      subPipeline
    );

    // console.dir(stage,{depth:Infinity})

    pipeline.push(...stage);
  }

  return pipeline;
}

export const enum RelationType {
  One = "onetoone",
  Many = "onetomany"
}

export interface RelationPath {
  type: "array" | "object";
  field: string;
  children?: RelationPath;
}

export interface RelationMap {
  path?: RelationPath;
  type: RelationType;
  target: string;
  field: string;
  children?: RelationMap[];
}

interface RelationMapOptions {
  resolve: (id: string) => Promise<Bucket>;
  paths: string[][];
  properties: object;
}

function getDeepestChildren(path: RelationPath): RelationPath {
  if (!path.children) {
    return path;
  }
  return getDeepestChildren(path.children);
}

function addRelationPath(path: RelationPath, field: string, type: "object" | "array") {
  if (!path) {
    return {field, type};
  }

  const copyPath = deepCopy(path);
  const deepestChildren = getDeepestChildren(copyPath);
  deepestChildren.children = {field, type};

  return copyPath;
}

export async function createRelationMap(options: RelationMapOptions): Promise<RelationMap[]> {
  const visit = async (
    properties: object,
    paths: string[][],
    depth: number,
    path?: RelationPath
  ): Promise<RelationMap[]> => {
    const maps = [];
    for (const [propertyKey, propertySpec] of Object.entries(properties)) {
      const matchingPaths = paths.filter(
        segments =>
          segments[depth] == propertyKey &&
          // if the child field of this document is requested too
          segments.length >= depth
      );

      if (!matchingPaths.length) {
        continue;
      }

      if (propertySpec.type == "object") {
        const updatedPath = addRelationPath(path, propertyKey, "object");
        const map = await visit(propertySpec.properties, matchingPaths, depth + 1, updatedPath);
        maps.push(...map);
      } else if (propertySpec.type == "array") {
        const updatedPath = addRelationPath(path, propertyKey, "array");
        // assume that array is an object array
        const map = await visit(propertySpec.items.properties, matchingPaths, depth + 1, updatedPath);
        maps.push(...map);
      } else if (propertySpec.type == "relation") {
        const schema = await options.resolve(propertySpec.bucketId);
        const children = await visit(schema.properties, matchingPaths, depth + 1);
        const map = {
          path,
          field: propertyKey,
          target: propertySpec.bucketId,
          type: propertySpec.relationType,
          children: children.length ? children : undefined
        };
        maps.push(map);
      }
    }

    return maps;
  };

  return visit(options.properties, options.paths, 0);
}

interface ResetNonOverlappingPathsOptions {
  left: string[][];
  right: string[][];
  map: RelationMap[];
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
      const leftMatch = left.filter(segments => segments[depth] == relation.field);
      const rightMatch = right.filter(segments => segments[depth] == relation.field);

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
    if (!usedRelations.includes(map.field)) {
      const paths = createRelationPaths(deepCopy(map));
      usedRelations.push(...paths);
      updatedRelationMap.push(map);
      continue;
    }

    if (map.children && map.children.length) {
      for (const child of map.children) {
        child.field = map.field + "." + child.field;
      }
      const updatedChilds = compareAndUpdateRelations(map.children, usedRelations);
      updatedRelationMap.push(...updatedChilds);
    }
  }
  return updatedRelationMap;
}

function createRelationPaths(relationMap: RelationMap): string[] {
  const paths = [];
  paths.push(relationMap.field);

  if (relationMap.children && relationMap.children.length) {
    for (const childMap of relationMap.children) {
      childMap.field = relationMap.field + "." + childMap.field;
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

type RelationDefinition = {
  type: "relation";
  bucketId: string;
  relationType: RelationType;
  dependent: boolean;
};

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

  let path = deepCopy(property);
  path = replaceArraysInPath(path);

  let _let;

  if (type == RelationType.One) {
    _let = {
      documentId: {
        $toObjectId: `$${path}`
      }
    };
    pipeline.push({$match: {$expr: {$eq: ["$_id", "$$documentId"]}}});
  } else if (type == RelationType.Many) {
    _let = {
      documentIds: {
        $ifNull: [
          {
            $map: {
              input: `$${path}`,
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
      as: path,
      let: _let,
      pipeline
    }
  };

  const aggregation: any =
    type == RelationType.One
      ? [lookup, {$unwind: {path: `$${path}`, preserveNullAndEmptyArrays: true}}]
      : [lookup];

  if (isOneOfParentsArray(property)) {
    const arrayField = getUntilArrayPart(property);
    aggregation.unshift({
      $unwind: {
        path: `$${arrayField}`,
        preserveNullAndEmptyArrays: true
      }
    });

    /*
    this field is for group aggregation because group aggregation doesn't accept nested fields, 
    we will replace dots in the path with underline, 
    then we will put them to the result at the final stage
    */
    const underlinedField = replaceDotsWithUnderline(arrayField);

    aggregation.push({
      $group: {
        _id: "$_id",
        // to keep all of fields
        _doc_: {
          $first: "$$ROOT"
        },
        [underlinedField]: {
          $push: `$${arrayField}`
        }
      }
    });

    aggregation.push({
      $addFields: {
        [`_doc_.${arrayField}`]: `$${underlinedField}`
      }
    });

    aggregation.push({
      $replaceRoot: {
        newRoot: "$_doc_"
      }
    });
  }

  return aggregation;
}

function isOneOfParentsArray(str: string) {
  return /\[.+\]/.test(str);
}

function getUntilArrayPart(str: string) {
  return str.substring(0, str.indexOf("]")).replace(/[\[|\]]/g, "");
}

function replaceArraysInPath(str: string) {
  return str.replace(/[\[|\]]/g, "");
}

function replaceDotsWithUnderline(str: string) {
  return str.replace(".", "_");
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
