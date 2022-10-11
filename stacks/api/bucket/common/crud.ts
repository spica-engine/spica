import {BaseCollection, ObjectId} from "@spica-server/database";
import * as expression from "@spica-server/bucket/expression";
import {
  Bucket,
  BucketDocument,
  BucketPreferences,
  LimitExceedBehaviours
} from "@spica-server/bucket/services";
import {
  createRelationMap,
  getRelationPipeline,
  RelationMap,
  resetNonOverlappingPathsInRelationMap
} from "./relation";
import {getUpdateQueryForPatch} from "@spica-server/core/patch";
import {iPipelineBuilder, PipelineBuilder} from "./pipeline.builder";
import {
  ACLSyntaxException,
  BadRequestException,
  DatabaseException,
  ForbiddenException
} from "./exception";

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
  collection: (schema: Bucket) => BaseCollection<T>;
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
  const collection = factories.collection(schema);
  const pipelineBuilder: iPipelineBuilder = new PipelineBuilder(schema, factories);
  const seekingPipelineBuilder: iPipelineBuilder = new PipelineBuilder(schema, factories);

  let rulePropertyMap;
  let ruleRelationMap: RelationMap[];

  let basePipeline = await pipelineBuilder
    .findOneIfRequested(params.documentId)
    .filterResources(params.resourceFilter);

  if (typeof options.schedule == "boolean") {
    basePipeline = basePipeline.filterScheduledData(options.schedule);
  }

  basePipeline = await basePipeline.localize(options.localize, params.language, locale => {
    params.req.res.header("Content-language", locale.best || locale.fallback);
  });

  const rulesAppliedPipeline = await basePipeline
    .rules(params.req.user, (propertyMap, relationMap) => {
      rulePropertyMap = propertyMap;
      ruleRelationMap = relationMap;
    })
    .catch(error => {
      throw new ACLSyntaxException(error.message);
    });

  const ruleResetStage = resetNonOverlappingPathsInRelationMap({
    left: [],
    right: rulePropertyMap,
    map: ruleRelationMap
  });
  // Reset those relations which have been requested by acl rules.
  const filtersAppliedPipeline = await rulesAppliedPipeline
    .attachToPipeline(!!ruleResetStage, ruleResetStage)
    .filterByUserRequest(params.filter);

  const seekingPipeline: iPipelineBuilder = seekingPipelineBuilder
    .sort(params.sort)
    .skip(params.skip)
    .limit(params.limit);

  const relationPropertyMap = params.relationPaths || [];

  const relationPathResolvedPipeline = await filtersAppliedPipeline.resolveRelationPath(
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
    seeking,
    collection.estimatedDocumentCount()
  )).result();

  if (options.paginate) {
    const result = await collection
      .aggregate<CrudPagination<T>>(pipeline)
      .next()
      .catch(error => {
        throw new DatabaseException(error.message);
      });
    return result.data.length ? result : {meta: {total: 0}, data: []};
  }

  return collection
    .aggregate<T>([...pipeline, ...seeking])
    .toArray()
    .catch(error => {
      throw new DatabaseException(error.message);
    });
}

export async function insertDocument(
  schema: Bucket,
  document: BucketDocument,
  params: {
    req: any;
  },
  factories: {
    collection: (schema: Bucket) => BaseCollection<any>;
    schema: (id: string | ObjectId) => Promise<Bucket>;
    deleteOne: (documentId: ObjectId) => Promise<void>;
  }
) {
  const collection = factories.collection(schema);
  await executeWriteRule(
    schema,
    factories.schema,
    document,
    // unlike others, we have to run this pipeline against buckets in case the target
    // collection is empty.
    collection.collection("buckets"),
    params.req.user
  );

  if (
    schema.documentSettings &&
    schema.documentSettings.limitExceedBehaviour == LimitExceedBehaviours.REMOVE
  ) {
    const documentCount = await collection.estimatedDocumentCount();
    const diff = documentCount + 1 - schema.documentSettings.countLimit;
    for (let i = 0; i < diff; i++) {
      const oldestDocument = await collection
        .aggregate<BucketDocument>([{$sort: {_id: 1}}, {$limit: 1}])
        .next();
      await factories.deleteOne(oldestDocument._id);
    }
  }

  return collection.insertOne(document).catch(handleWriteErrors);
}

export async function replaceDocument(
  schema: Bucket,
  document: BucketDocument,
  params: {
    req: any;
  },
  factories: {
    collection: (schema: Bucket) => BaseCollection<any>;
    schema: (id: string | ObjectId) => Promise<Bucket>;
  },
  options: {
    returnOriginal: boolean;
  } = {returnOriginal: true}
) {
  const collection = factories.collection(schema);

  await executeWriteRule(schema, factories.schema, document, collection, params.req.user);

  const documentId = document._id;
  delete document._id;

  return collection
    .findOneAndReplace({_id: documentId}, document, {
      returnOriginal: options.returnOriginal
    })
    .catch(handleWriteErrors);
}

export async function patchDocument(
  schema: Bucket,
  document: BucketDocument,
  patch: any,
  params: {
    req: any;
  },
  factories: {
    collection: (schema: Bucket) => BaseCollection<any>;
    schema: (id: string | ObjectId) => Promise<Bucket>;
  },
  options: {
    returnOriginal: boolean;
  } = {returnOriginal: true}
) {
  const collection = factories.collection(schema);

  await executeWriteRule(schema, factories.schema, document, collection, params.req.user);

  delete patch._id;

  const updateQuery = getUpdateQueryForPatch(patch, document);

  return collection
    .findOneAndUpdate({_id: document._id}, updateQuery, {
      returnOriginal: options.returnOriginal
    })
    .catch(handleWriteErrors);
}

export async function deleteDocument(
  schema: Bucket,
  documentId: string | ObjectId,
  params: {
    req: any;
  },
  factories: {
    collection: (schema: Bucket) => BaseCollection<BucketDocument>;
    schema: (schema: string | ObjectId) => Promise<Bucket>;
  }
) {
  const collection = factories.collection(schema);

  const document = await collection.findOne({_id: new ObjectId(documentId)});

  if (!document) {
    return;
  }

  await executeWriteRule(schema, factories.schema, document, collection, params.req.user);

  const deletedCount = await collection.deleteOne({_id: document._id});

  if (deletedCount == 1) {
    return document;
  }
}

async function executeWriteRule(
  schema: Bucket,
  resolve: (id: string) => Promise<Bucket>,
  document: BucketDocument,
  collection: BaseCollection<unknown>,
  auth: object
) {
  let paths;

  try {
    paths = expression.extractPropertyMap(schema.acl.write).map(path => path.split("."));
  } catch (error) {
    throw new ACLSyntaxException(error.message);
  }

  const relationMap = await createRelationMap({
    properties: schema.properties,
    paths,
    resolve
  });

  const relationStage = getRelationPipeline(relationMap, undefined);

  const aggregation = [
    {$limit: 1},
    {
      $replaceWith: {$literal: document}
    },
    ...relationStage
  ];

  const fullDocument = await collection
    .aggregate(aggregation)
    .next()
    .catch(error => {
      throw new DatabaseException(error.message);
    });

  let aclResult;

  try {
    aclResult = expression.run(schema.acl.write, {
      auth,
      document: fullDocument
    });
  } catch (error) {
    throw new ACLSyntaxException(error.message);
  }

  if (!aclResult) {
    throw new ForbiddenException("ACL rules has rejected this operation.");
  }
}

function getProjectAggregation(fieldMap: string[][]) {
  const result = {};
  for (const fields of fieldMap) {
    result[fields.join(".")] = 1;
  }
  return {$project: result};
}

function handleWriteErrors(error: any) {
  if (error.code === 11000) {
    throw new BadRequestException(
      `Value of the property .${Object.keys(error.keyValue)[0]} should unique across all documents.`
    );
  }

  throw new DatabaseException(error.message);
}

export function authIdToString(req: any) {
  if (req.user && req.user._id) {
    req.user._id = req.user._id.toString();
  }
  return req;
}
