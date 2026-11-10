import * as expression from "@spica-server/bucket-expression";
import {Bucket, BucketDocument} from "@spica-server/interface-bucket";
import {
  BucketQueryFacade,
  BucketWriteContext,
  RelationMap,
  RelationType
} from "@spica-server/interface-bucket-common";
import {ACLSyntaxException, DatabaseException, ForbiddenException} from "./exception.js";
import {buildExpressionReplacers} from "./expression.filter.js";
import {categorizePropertyMap} from "./helpers.js";
import {createRelationMap} from "./relation.js";

export interface WriteRuleCheck {
  bucket: Bucket;
  document: BucketDocument;
  auth: unknown;
  context: BucketWriteContext;
  query: BucketQueryFacade;
}

export async function checkWriteRule(check: WriteRuleCheck): Promise<void> {
  const {bucket, document, auth, context, query} = check;

  let propertyMap: string[][] = [];

  try {
    propertyMap = expression.extractPropertyMap(bucket.acl.write);
  } catch (error) {
    throw new ACLSyntaxException(error.message);
  }

  const {documentPropertyMap} = categorizePropertyMap(propertyMap);

  const relationMap = await createRelationMap({
    properties: bucket.properties,
    paths: documentPropertyMap,
    resolve: context.resolveSchema
  });

  const fullDocument = await withRelatedRecords(
    document,
    relationMap,
    documentPropertyMap,
    query,
    context
  );

  const replacers = await buildExpressionReplacers(
    bucket,
    documentPropertyMap,
    context.resolveSchema,
    context.hashSecret
  );

  let aclResult;

  try {
    aclResult = expression.runWithReplacers(
      bucket.acl.write,
      {auth, document: fullDocument},
      "match",
      replacers
    );
  } catch (error) {
    throw new ACLSyntaxException(error.message);
  }

  if (!aclResult) {
    throw new ForbiddenException("ACL rules has rejected this operation.");
  }
}

async function withRelatedRecords(
  document: BucketDocument,
  relations: RelationMap[],
  propertyMap: string[][],
  query: BucketQueryFacade,
  context: BucketWriteContext
): Promise<BucketDocument> {
  const loaded = await Promise.all(
    relations.map(relation => loadRelatedRecords(document, relation, propertyMap, query, context))
  );

  return relations.reduce((resolved, relation, index) => {
    const segments = relation.path.split(".");
    const records = loaded[index];

    if (relation.type == RelationType.Many) {
      return setAt(resolved, segments, records);
    }
    return records.length ? setAt(resolved, segments, records[0]) : unsetAt(resolved, segments);
  }, document);
}

async function loadRelatedRecords(
  document: BucketDocument,
  relation: RelationMap,
  propertyMap: string[][],
  query: BucketQueryFacade,
  context: BucketWriteContext
): Promise<BucketDocument[]> {
  const segments = relation.path.split(".");
  const references = [valueAt(document, segments)]
    .flat()
    .filter(reference => reference !== undefined && reference !== null);

  if (!references.length) {
    return [];
  }

  const relationPaths = propertyMap
    .filter(
      path => path.length > segments.length && segments.every((segment, i) => path[i] == segment)
    )
    .map(path => path.slice(segments.length));

  try {
    const {result} = await query.find<BucketDocument>(
      relation.schema,
      {
        resourceFilter: {include: references.map(String), exclude: []},
        relationPaths
      },
      {
        resolveSchema: context.resolveSchema,
        preferences: () => Promise.reject(new Error("Preferences are not read for write rules.")),
        hashSecret: context.hashSecret
      }
    );
    return result;
  } catch (error) {
    throw new DatabaseException(error.message);
  }
}

function valueAt(source: object, segments: string[]) {
  return segments.reduce((value, segment) => value?.[segment], source as any);
}

function setAt<T extends object>(source: T, segments: string[], value: unknown): T {
  const [head, ...rest] = segments;
  return {
    ...source,
    [head]: rest.length ? setAt((source[head] as object) ?? {}, rest, value) : value
  };
}

function unsetAt<T extends object>(source: T, segments: string[]): T {
  const [head, ...rest] = segments;
  if (!rest.length) {
    const {[head]: _removed, ...remaining} = source as Record<string, unknown>;
    return remaining as T;
  }
  return source[head] ? {...source, [head]: unsetAt(source[head] as object, rest)} : source;
}
