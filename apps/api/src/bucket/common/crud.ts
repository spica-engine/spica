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
import {
  ACLSyntaxException,
  BadRequestException,
  DatabaseException,
  ForbiddenException
} from "./exception";
import {IAuthResolver} from "./interface";
import {categorizePropertyMap} from "./helpers";
import {BucketPipelineBuilder} from "./pipeline.builder";
import {PipelineBuilder} from "@spica-server/database/pipeline";

interface CrudOptions<Paginate> {
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
  authResolver: IAuthResolver;
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
  const pipelineBuilder = new BucketPipelineBuilder(schema, factories);
  const seekingPipelineBuilder = new PipelineBuilder();

  let rulePropertyMap;
  let ruleRelationMap: RelationMap[];

  let basePipeline = await pipelineBuilder
    .findOneIfRequested(params.documentId)
    .filterResources(params.resourceFilter);

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
    .filterByUserRequest(params.filter as object);

  const seekingPipeline = seekingPipelineBuilder
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
  seekingPipeline.setVisibilityOfFields(getVisibilityOfFields(params.projectMap));

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
    authResolver: IAuthResolver;
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
    params.req.user,
    factories.authResolver
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
    authResolver: IAuthResolver;
  },
  options: {
    returnOriginal: boolean;
  } = {returnOriginal: true}
) {
  const collection = factories.collection(schema);

  await executeWriteRule(
    schema,
    factories.schema,
    document,
    collection,
    params.req.user,
    factories.authResolver
  );

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
    authResolver: IAuthResolver;
  },
  options: {
    returnOriginal: boolean;
  } = {returnOriginal: true}
) {
  const collection = factories.collection(schema);

  await executeWriteRule(
    schema,
    factories.schema,
    document,
    collection,
    params.req.user,
    factories.authResolver
  );

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
    authResolver: IAuthResolver;
  }
) {
  const collection = factories.collection(schema);

  const document = await collection.findOne({_id: new ObjectId(documentId)});

  if (!document) {
    return;
  }

  await executeWriteRule(
    schema,
    factories.schema,
    document,
    collection,
    params.req.user,
    factories.authResolver
  );

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
  auth: object,
  authResolver: IAuthResolver
) {
  let propertyMap = [];

  try {
    propertyMap = expression.extractPropertyMap(schema.acl.write);
  } catch (error) {
    throw new ACLSyntaxException(error.message);
  }

  const {authPropertyMap, documentPropertyMap} = categorizePropertyMap(propertyMap);

  const authRelationMap = await createRelationMap({
    paths: authPropertyMap,
    properties: authResolver.getProperties(),
    resolve: resolve
  });
  const authRelationStage = getRelationPipeline(authRelationMap, undefined);
  auth = await authResolver.resolveRelations(auth, authRelationStage);

  const documentRelationMap = await createRelationMap({
    properties: schema.properties,
    paths: documentPropertyMap,
    resolve
  });

  const documentRelationStage = getRelationPipeline(documentRelationMap, undefined);

  const aggregation = [
    {$limit: 1},
    {
      $replaceWith: {$literal: document}
    },
    ...documentRelationStage
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

function getVisibilityOfFields(fieldMap: string[][]) {
  const result = {};
  for (const fields of fieldMap) {
    result[fields.join(".")] = 1;
  }
  return result;
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
