import {ForbiddenException} from "@nestjs/common";
import {BaseCollection, ObjectId} from "@spica-server/database";
import * as expression from "@spica-server/bucket/expression";
import {Bucket, BucketDocument, BucketPreferences} from "@spica-server/bucket/services";
import {buildI18nAggregation, findLocale, hasTranslatedProperties} from "./locale";
import {
  createRelationMap,
  getRelationPipeline,
  resetNonOverlappingPathsInRelationMap,
  compareAndUpdateRelations
} from "./relation";
import {getUpdateQueryForPatch, deepCopy} from "./patch";

interface CrudOptions<Paginate> {
  schedule?: boolean;
  localize?: boolean;
  paginate?: Paginate;
}

interface CrudParams {
  resourceFilter?: object;
  documentId?: ObjectId;
  filter?: object | string;
  language?: string;
  relationPaths: string[][];
  req: any;
  sort?: object;
  skip?: number;
  limit?: number;
  projectMap: string[][];
}

interface CrudFactories<T> {
  collection: (id: string | ObjectId) => BaseCollection<T>;
  preference: () => Promise<BucketPreferences>;
  schema: (id: string | ObjectId) => Promise<Bucket>;
}

export interface CrudPagination<T> {
  meta: {total: number};
  data: T[];
}

export async function findDocuments<T>(
  schema: Bucket,
  params: CrudParams,
  options: CrudOptions<false>,
  factories: CrudFactories<T>
): Promise<T[]>;
export async function findDocuments<T>(
  schema: Bucket,
  params: CrudParams,
  options: CrudOptions<true>,
  factories: CrudFactories<T>
): Promise<CrudPagination<T>>;
export async function findDocuments<T>(
  schema: Bucket,
  params: CrudParams,
  options: CrudOptions<boolean>,
  factories: CrudFactories<T>
): Promise<T[] | CrudPagination<T>>;
export async function findDocuments<T>(
  schema: Bucket,
  params: CrudParams,
  options: CrudOptions<boolean>,
  factories: CrudFactories<T>
): Promise<unknown> {
  const collection = factories.collection(schema._id);

  const pipeline: object[] = [];

  // for reducing findone response time
  if (params.documentId) {
    pipeline.push({$match: {_id: params.documentId}});
  }

  // resourcefilter
  if (params.resourceFilter) {
    pipeline.push(params.resourceFilter);
  }

  // scheduled contents
  pipeline.push({$match: {_schedule: {$exists: !!options.schedule}}});

  //localization
  let locale;
  if (options.localize && hasTranslatedProperties(schema)) {
    locale = findLocale(params.language, await factories.preference());
    pipeline.push({
      $replaceWith: buildI18nAggregation("$$ROOT", locale.best, locale.fallback)
    });

    params.req.res.header("Content-language", locale.best || locale.fallback);
  }

  // matching for rules and filters
  pipeline.push({
    $set: {
      _id: {
        $toString: "$_id"
      }
    }
  });

  // rules
  const rulePropertyMap = expression
    .extractPropertyMap(schema.acl.read)
    .map(path => path.split("."));

  let ruleRelationMap = await createRelationMap({
    paths: rulePropertyMap,
    properties: schema.properties,
    resolve: factories.schema
  });

  const ruleRelationStage = getRelationPipeline(ruleRelationMap, locale);
  pipeline.push(...ruleRelationStage);

  const ruleExpression = expression.aggregate(schema.acl.read, {auth: params.req.user});
  pipeline.push({$match: ruleExpression});

  const ruleResetStage = resetNonOverlappingPathsInRelationMap({
    left: [],
    right: rulePropertyMap,
    map: ruleRelationMap
  });

  if (ruleResetStage) {
    // Reset those relations which have been requested by acl rules.
    pipeline.push(ruleResetStage);
  }

  const usedRelationPaths: string[] = [];

  let filterPropertyMap: string[][] = [];
  let filterRelationMap: object[] = [];
  // filter
  if (params.filter) {
    let filterExpression: object;

    if (typeof params.filter == "object" && Object.keys(params.filter).length) {
      filterPropertyMap = extractFilterPropertyMap(params.filter);

      filterExpression = params.filter;
    } else if (typeof params.filter == "string") {
      filterPropertyMap = expression.extractPropertyMap(params.filter).map(path => path.split("."));

      filterExpression = expression.aggregate(params.filter, {});
    }

    filterRelationMap = await createRelationMap({
      paths: filterPropertyMap,
      properties: schema.properties,
      resolve: factories.schema
    });

    const updatedFilterRelationMap = compareAndUpdateRelations(
      deepCopy(filterRelationMap),
      usedRelationPaths
    );

    const filterRelationStage = getRelationPipeline(updatedFilterRelationMap, locale);
    pipeline.push(...filterRelationStage);

    if (filterExpression) {
      pipeline.push({$match: filterExpression});
    }
  }

  // sort,skip and limit
  const seekingPipeline = [];

  if (Object.keys(params.sort || {}).length) {
    seekingPipeline.push({$sort: params.sort});
  }

  if (params.skip) {
    seekingPipeline.push({$skip: params.skip});
  }

  if (params.limit) {
    seekingPipeline.push({$limit: params.limit});
  }

  let relationPropertyMap = params.relationPaths || [];
  let relationMap = [];
  if (relationPropertyMap.length) {
    relationMap = await createRelationMap({
      paths: params.relationPaths,
      properties: schema.properties,
      resolve: factories.schema
    });
    const updatedRelationMap = compareAndUpdateRelations(deepCopy(relationMap), usedRelationPaths);

    const relationStage = getRelationPipeline(updatedRelationMap, locale);
    seekingPipeline.push(...relationStage);
  }

  // for graphql responses
  if (params.projectMap.length) {
    seekingPipeline.push(getProjectAggregation(params.projectMap));
  }

  if (options.paginate) {
    pipeline.push(
      {
        $facet: {
          meta: [{$count: "total"}],
          data: seekingPipeline.length ? seekingPipeline : [{$unwind: "$_id"}]
        }
      },
      {$unwind: {path: "$meta", preserveNullAndEmptyArrays: true}}
    );

    const result = await collection.aggregate<CrudPagination<T>>(pipeline).next();

    return result.data.length ? result : {meta: {total: 0}, data: []};
  }

  return collection.aggregate<T>([...pipeline, ...seekingPipeline]).toArray();
}

// it will work on only basic filters => {"user.name" : "John"}
function extractFilterPropertyMap(filter: any) {
  const map: string[][] = [];
  for (const fields of Object.keys(filter)) {
    const field = fields.split(".");
    map.push(field);
  }
  return map;
}

export async function insertDocument(
  schema: Bucket,
  document: BucketDocument,
  params: {
    req: any;
  },
  factories: {
    collection: (id: string | ObjectId) => any;
    schema: (id: string | ObjectId) => Promise<Bucket>;
  }
) {
  const collection = factories.collection(schema._id);

  const ruleAggregation = await getWriteRuleAggregation(schema, factories.schema, document);

  const fullDocument = await collection
    // unlike others, we have to run this pipeline against buckets in case the target
    // collection is empty.
    .collection("buckets")
    .aggregate(ruleAggregation)
    .next();

  const aclResult = expression.run(schema.acl.write, {
    auth: params.req.user,
    document: fullDocument
  });
  if (!aclResult) {
    throw new ForbiddenException("ACL rules has rejected this operation.");
  }

  return collection.insertOne(document);
}

export async function replaceDocument(
  schema: Bucket,
  document: BucketDocument,
  params: {
    req: any;
  },
  factories: {
    collection: (id: string | ObjectId) => any;
    schema: (id: string | ObjectId) => Promise<Bucket>;
  },
  options: {
    returnOriginal: boolean;
  } = {returnOriginal: true}
) {
  const collection = factories.collection(schema._id);

  const ruleAggregation = await getWriteRuleAggregation(schema, factories.schema, document);

  const fullDocument = await collection.aggregate(ruleAggregation).next();

  const aclResult = expression.run(schema.acl.write, {
    auth: params.req.user,
    document: fullDocument
  });

  if (!aclResult) {
    throw new ForbiddenException("ACL rules has rejected this operation.");
  }

  const documentId = document._id;
  delete document._id;

  return collection.findOneAndReplace({_id: documentId}, document, {
    returnOriginal: options.returnOriginal
  });
}

export async function patchDocument(
  schema: Bucket,
  document: BucketDocument,
  patch: any,
  params: {
    req: any;
  },
  factories: {
    collection: (id: string | ObjectId) => any;
    schema: (id: string | ObjectId) => Promise<Bucket>;
  },
  options: {
    returnOriginal: boolean;
  } = {returnOriginal: true}
) {
  const collection = factories.collection(schema._id);

  const ruleAggregation = await getWriteRuleAggregation(schema, factories.schema, document);

  const fullDocument = await collection.aggregate(ruleAggregation).next();

  const aclResult = expression.run(schema.acl.write, {
    auth: params.req.user,
    document: fullDocument
  });

  if (!aclResult) {
    throw new ForbiddenException("ACL rules has rejected this operation.");
  }

  const updateQuery = getUpdateQueryForPatch(patch);

  return collection.findOneAndUpdate({_id: document._id}, updateQuery, {
    returnOriginal: options.returnOriginal
  });
}

export async function deleteDocument(
  schema: Bucket,
  documentId: ObjectId,
  params: {
    req: any;
  },
  factories: {
    collection: (id: string | ObjectId) => any;
    schema: (id: string | ObjectId) => Promise<Bucket>;
  }
) {
  const collection = factories.collection(schema._id);

  const document = collection.findOne({_id: new ObjectId(documentId)});

  const ruleAggregation = await getWriteRuleAggregation(schema, factories.schema, document);

  const fullDocument = await collection.aggregate(ruleAggregation).next();

  const aclResult = expression.run(schema.acl.write, {
    auth: params.req.user,
    document: fullDocument
  });

  if (!aclResult) {
    throw new ForbiddenException("ACL rules has rejected this operation.");
  }

  const deletedCount = await collection.deleteOne({_id: documentId});

  if (deletedCount == 1) {
    return document;
  }
}

async function getWriteRuleAggregation(schema: Bucket, resolve: any, document: BucketDocument) {
  const paths = expression.extractPropertyMap(schema.acl.write).map(path => path.split("."));

  const relationMap = await createRelationMap({
    properties: schema.properties,
    paths,
    resolve: resolve
  });

  const relationStage = getRelationPipeline(relationMap, undefined);

  return [
    {$limit: 1},
    {
      $replaceWith: {$literal: document}
    },
    ...relationStage
  ];
}

function getProjectAggregation(fieldMap: string[][]) {
  const result = {};
  for (const fields of fieldMap) {
    result[fields.join(".")] = 1;
  }
  return {$project: result};
}
