import {BaseCollection, ObjectId, ReturnDocument} from "@spica-server/database";
import * as expression from "@spica-server/bucket/expression";
import {
  createRelationMap,
  getRelationPipeline,
  resetNonOverlappingPathsInRelationMap
} from "./relation";
import {getUpdateQueryForPatch} from "@spica-server/core/patch";
import {
  ACLSyntaxException,
  BadRequestException,
  DatabaseException,
  ForbiddenException
} from "./exception";
import {IAuthResolver} from "@spica-server/interface/bucket/common";
import {categorizePropertyMap} from "./helpers";
import {BucketPipelineBuilder} from "./pipeline.builder";
import {PipelineBuilder} from "@spica-server/database/pipeline";
import {
  CrudOptions,
  CrudParams,
  CrudFactories,
  CrudPagination,
  RelationMap
} from "@spica-server/interface/bucket/common";
import {Bucket, LimitExceedBehaviours, BucketDocument} from "@spica-server/interface/bucket";

export async function findDocuments<T>(
  schema: Bucket,
  params: CrudParams,
  options: CrudOptions<false>,
  factories: CrudFactories<T>,
  hashSecret?: string
): Promise<T[]>;
export async function findDocuments<T>(
  schema: Bucket,
  params: CrudParams,
  options: CrudOptions<true>,
  factories: CrudFactories<T>,
  hashSecret?: string
): Promise<CrudPagination<T>>;
export async function findDocuments<T>(
  schema: Bucket,
  params: CrudParams,
  options: CrudOptions<boolean>,
  factories: CrudFactories<T>,
  hashSecret?: string
): Promise<T[] | CrudPagination<T>>;
export async function findDocuments<T>(
  schema: Bucket,
  params: CrudParams,
  options: CrudOptions<boolean>,
  factories: CrudFactories<T>,
  hashSecret?: string
): Promise<unknown> {
  const collection = factories.collection(schema);
  const pipelineBuilder = new BucketPipelineBuilder(schema, factories, hashSecret);
  const seekingPipelineBuilder = new PipelineBuilder();

  let rulePropertyMap;
  let ruleRelationMap: RelationMap[];
  let filtersAppliedPipeline;

  let basePipeline = await pipelineBuilder
    .findOneIfRequested(params.documentId)
    .filterResources(params.resourceFilter);

  basePipeline = await basePipeline.localize(options.localize, params.language, locale => {
    params.req.res.header("Content-language", locale.best || locale.fallback);
  });

  if (params.applyAcl) {
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
    filtersAppliedPipeline = await rulesAppliedPipeline
      .attachToPipeline(!!ruleResetStage, ruleResetStage)
      .filterByUserRequest(params.filter);
  } else {
    filtersAppliedPipeline = await basePipeline.filterByUserRequest(params.filter);
  }

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

  if (params.applyAcl) {
    const aclProjection = buildAclProjection(schema.properties, params.req.user);
    seekingPipelineBuilder.attachToPipeline(true, {$project: aclProjection});
  }
  // for graphql responses
  seekingPipeline.setVisibilityOfFields(getVisibilityOfFields(params.projectMap));

  const seeking = seekingPipeline.result();

  const pipeline = (
    await relationPathResolvedPipeline.paginate(
      options.paginate,
      seeking,
      collection.estimatedDocumentCount()
    )
  ).result();

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
function buildAclProjection(properties: Record<string, {acl?: string}>, user: any) {
  const result: Record<string, object | number> = {};

  for (const key in properties) {
    const acl = properties[key].acl;

    if (acl) {
      const condition = expression.aggregate(acl, {auth: user}, "project");

      result[key] = {
        $cond: {
          if: condition,
          then: "$" + key,
          else: "$$REMOVE"
        }
      };
    } else {
      result[key] = 1;
    }
  }

  return result;
}

export async function insertDocument(
  schema: Bucket,
  document: BucketDocument,
  params: {
    req: any;
    applyAcl?: boolean;
  },
  factories: {
    collection: (schema: Bucket) => BaseCollection<any>;
    schema: (id: string | ObjectId) => Promise<Bucket>;
    deleteOne: (documentId: ObjectId) => Promise<void>;
    authResolver: IAuthResolver;
  }
) {
  const collection = factories.collection(schema);

  if (params.applyAcl) {
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
  }
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
    applyAcl?: boolean;
  },
  factories: {
    collection: (schema: Bucket) => BaseCollection<any>;
    schema: (id: string | ObjectId) => Promise<Bucket>;
    authResolver: IAuthResolver;
  },
  options: {
    returnDocument: ReturnDocument;
  } = {returnDocument: ReturnDocument.BEFORE}
) {
  const collection = factories.collection(schema);

  if (params.applyAcl) {
    await executeWriteRule(
      schema,
      factories.schema,
      document,
      collection,
      params.req.user,
      factories.authResolver
    );
  }

  const documentId = document._id;
  delete document._id;

  return collection
    .findOneAndReplace({_id: documentId}, document, {
      returnDocument: options.returnDocument
    })
    .catch(handleWriteErrors);
}

export async function patchDocument(
  schema: Bucket,
  document: BucketDocument,
  patch: any,
  params: {
    req: any;
    applyAcl?: boolean;
  },
  factories: {
    collection: (schema: Bucket) => BaseCollection<any>;
    schema: (id: string | ObjectId) => Promise<Bucket>;
    authResolver: IAuthResolver;
  },
  options: {
    returnDocument: ReturnDocument;
  } = {returnDocument: ReturnDocument.BEFORE}
) {
  const collection = factories.collection(schema);
  if (params.applyAcl) {
    await executeWriteRule(
      schema,
      factories.schema,
      document,
      collection,
      params.req.user,
      factories.authResolver
    );
  }

  delete patch._id;

  const updateQuery = getUpdateQueryForPatch(patch, document);

  return collection
    .findOneAndUpdate({_id: document._id}, updateQuery, {
      returnDocument: options.returnDocument
    })
    .catch(handleWriteErrors);
}

export async function deleteDocument(
  schema: Bucket,
  documentId: string | ObjectId,
  params: {
    req: any;
    applyAcl?: boolean;
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

  if (params.applyAcl) {
    await executeWriteRule(
      schema,
      factories.schema,
      document,
      collection,
      params.req.user,
      factories.authResolver
    );
  }

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
    aclResult = expression.run(
      schema.acl.write,
      {
        auth,
        document: fullDocument
      },
      "match"
    );
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
