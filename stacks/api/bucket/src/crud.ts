import {ForbiddenException} from "@nestjs/common";
import {BaseCollection, ObjectId} from "@spica-server/database";
import * as expression from "@spica-server/bucket/expression";
import {Bucket, BucketDocument, BucketPreferences} from "@spica-server/bucket/services";
import {
  createRelationMap,
  getRelationPipeline,
  RelationMap,
  resetNonOverlappingPathsInRelationMap
} from "./relation";
import {getUpdateQueryForPatch} from "./patch";
import {iPipelineBuilder, PipelineBuilder} from "./pipeline.builder";

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

export interface CrudFactories<T> {
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
  const pipelineBuilder: iPipelineBuilder = new PipelineBuilder(schema, factories);
  const seekingPipelineBuilder: iPipelineBuilder = new PipelineBuilder(schema, factories);
  let requestedLocale;
  let rulePropertyMap;
  let ruleRelationMap: RelationMap[];

  let filteredPipeline = await pipelineBuilder
    .findOneIfRequested(params.documentId)
    .filterResources(params.resourceFilter)
    .filterScheduledData(!!options.schedule)
    .localize(options.localize, params.language, locale => {
      requestedLocale = locale;
      params.req.res.header("Content-language", locale.best || locale.fallback);
    });
  let rulesAppliedPipeline = await filteredPipeline.rules(
    params.req.user,
    (propertyMap, relationMap) => {
      rulePropertyMap = propertyMap;
      ruleRelationMap = relationMap;
    }
  );

  const ruleResetStage = resetNonOverlappingPathsInRelationMap({
    left: [],
    right: rulePropertyMap,
    map: ruleRelationMap
  });
  // Reset those relations which have been requested by acl rules.
  let filtersAppliedPipeline = await rulesAppliedPipeline
    .attachToPipeline(ruleResetStage, ruleResetStage)
    .filterByUserRequest(params.filter);

  const seekingPipeline: iPipelineBuilder = seekingPipelineBuilder
    .sort(params.sort)
    .skip(params.skip)
    .limit(params.limit);

  let relationPropertyMap = params.relationPaths || [];
  let relationPathResolvedPipeline = await filtersAppliedPipeline.resolveRelationPath(
    relationPropertyMap,
    relationStage => {
      seekingPipeline.attachToPipeline(true, ...relationStage);
    }
  );

  // for graphql responses
  seekingPipeline.attachToPipeline(
    params.projectMap.length,
    getProjectAggregation(params.projectMap)
  );
  const seeking = seekingPipeline.result();
  const pipeline = (await relationPathResolvedPipeline.paginate(
    options.paginate,
    seeking
  )).result();
  if (options.paginate) {
    const result = await collection.aggregate<CrudPagination<T>>(pipeline).next();
    return result.data.length ? result : {meta: {total: 0}, data: []};
  }
  return collection.aggregate<T>([...pipeline, ...seeking]).toArray();
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
      $replaceWith: document
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
