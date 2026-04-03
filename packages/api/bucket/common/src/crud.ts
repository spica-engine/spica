import {BaseCollection, ObjectId, ReturnDocument} from "@spica-server/database";
import * as expression from "@spica-server/bucket-expression";
import {
  createRelationMap,
  getRelationPipeline,
  resetNonOverlappingPathsInRelationMap
} from "./relation.js";
import {getUpdateQueryForPatch} from "@spica-server/core/patch";
import {
  ACLSyntaxException,
  BadRequestException,
  DatabaseException,
  ForbiddenException
} from "./exception.js";
import {categorizePropertyMap} from "./helpers.js";
import {BucketPipelineBuilder} from "./pipeline.builder.js";
import {PipelineBuilder} from "@spica-server/database/pipeline";
import {
  CrudOptions,
  CrudParams,
  CrudFactories,
  CrudPagination,
  RelationMap
} from "@spica-server/interface/bucket/common";
import {Bucket, LimitExceedBehaviours, BucketDocument} from "@spica-server/interface/bucket";
import {decryptDocumentFields} from "./decrypt.js";
import {buildExpressionReplacers} from "./expression.filter.js";

export async function findDocuments<T>(
  schema: Bucket,
  params: CrudParams,
  options: CrudOptions<false>,
  factories: CrudFactories<T>,
  hashSecret?: string,
  encryptionSecret?: string
): Promise<T[]>;
export async function findDocuments<T>(
  schema: Bucket,
  params: CrudParams,
  options: CrudOptions<true>,
  factories: CrudFactories<T>,
  hashSecret?: string,
  encryptionSecret?: string
): Promise<CrudPagination<T>>;
export async function findDocuments<T>(
  schema: Bucket,
  params: CrudParams,
  options: CrudOptions<boolean>,
  factories: CrudFactories<T>,
  hashSecret?: string,
  encryptionSecret?: string
): Promise<T[] | CrudPagination<T>>;
export async function findDocuments<T>(
  schema: Bucket,
  params: CrudParams,
  options: CrudOptions<boolean>,
  factories: CrudFactories<T>,
  hashSecret?: string,
  encryptionSecret?: string
): Promise<unknown> {
  const collection = factories.collection(schema);
  const pipelineBuilder = new BucketPipelineBuilder(
    schema,
    factories,
    hashSecret,
    encryptionSecret
  );
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
    const aclProjection = await buildAclProjection(
      schema,
      params.req.user,
      factories.schema,
      hashSecret
    );
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
    if (!result.data.length) {
      return {meta: {total: 0}, data: []};
    }
    if (encryptionSecret) {
      result.data = result.data.map(doc =>
        decryptDocumentFields(doc as any, schema, encryptionSecret, factories.schema)
      ) as T[];
    }
    return result;
  }

  const documents = await collection
    .aggregate<T>([...pipeline, ...seeking])
    .toArray()
    .catch(error => {
      throw new DatabaseException(error.message);
    });

  if (encryptionSecret) {
    return documents.map(doc =>
      decryptDocumentFields(doc as any, schema, encryptionSecret, factories.schema)
    ) as T[];
  }

  return documents;
}
async function buildAclProjection(
  schema: Bucket,
  user: any,
  schemaResolver: (id: string | ObjectId) => Promise<Bucket>,
  hashSecret?: string
) {
  const properties = schema.properties as Record<string, {acl?: string}>;
  const result: Record<string, object | number> = {};

  const allPropertyMaps: string[][] = [];
  for (const key in properties) {
    const acl = properties[key].acl;
    if (acl) {
      const propMap = expression.extractPropertyMap(acl);
      const {documentPropertyMap} = categorizePropertyMap(propMap);
      allPropertyMaps.push(...documentPropertyMap);
    }
  }

  const replacers = allPropertyMaps.length
    ? await buildExpressionReplacers(schema, allPropertyMaps, schemaResolver, hashSecret)
    : [];

  for (const key in properties) {
    const acl = properties[key].acl;

    if (acl) {
      const condition = expression.aggregateWithReplacers(acl, {auth: user}, "project", replacers);

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
  },
  hashSecret?: string,
  encryptionSecret?: string
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
      hashSecret
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

  const inserted = await collection.insertOne(document).catch(handleWriteErrors);

  if (encryptionSecret && inserted) {
    return decryptDocumentFields(inserted, schema, encryptionSecret, factories.schema);
  }

  return inserted;
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
  },
  options: {
    returnDocument: ReturnDocument;
  } = {returnDocument: ReturnDocument.BEFORE},
  hashSecret?: string,
  encryptionSecret?: string
) {
  const collection = factories.collection(schema);

  if (params.applyAcl) {
    await executeWriteRule(
      schema,
      factories.schema,
      document,
      collection,
      params.req.user,
      hashSecret
    );
  }

  const documentId = document._id;
  delete document._id;

  const replaced = await collection
    .findOneAndReplace({_id: documentId}, document, {
      returnDocument: options.returnDocument
    })
    .catch(handleWriteErrors);

  if (encryptionSecret && replaced) {
    return decryptDocumentFields(replaced, schema, encryptionSecret, factories.schema);
  }

  return replaced;
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
  },
  options: {
    returnDocument: ReturnDocument;
  } = {returnDocument: ReturnDocument.BEFORE},
  hashSecret?: string,
  encryptionSecret?: string
) {
  const collection = factories.collection(schema);
  if (params.applyAcl) {
    await executeWriteRule(
      schema,
      factories.schema,
      document,
      collection,
      params.req.user,
      hashSecret
    );
  }

  delete patch._id;

  const updateQuery = getUpdateQueryForPatch(patch, document);

  const patched = await collection
    .findOneAndUpdate({_id: document._id}, updateQuery, {
      returnDocument: options.returnDocument
    })
    .catch(handleWriteErrors);

  if (encryptionSecret && patched) {
    return decryptDocumentFields(patched, schema, encryptionSecret, factories.schema);
  }

  return patched;
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
  },
  hashSecret?: string,
  encryptionSecret?: string
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
      hashSecret
    );
  }

  const deletedCount = await collection.deleteOne({_id: document._id});

  if (deletedCount == 1) {
    if (encryptionSecret) {
      return decryptDocumentFields(document, schema, encryptionSecret, factories.schema);
    }
    return document;
  }
}

async function executeWriteRule(
  schema: Bucket,
  resolve: (id: string) => Promise<Bucket>,
  document: BucketDocument,
  collection: BaseCollection<unknown>,
  auth: object,
  hashSecret?: string
) {
  let propertyMap = [];

  try {
    propertyMap = expression.extractPropertyMap(schema.acl.write);
  } catch (error) {
    throw new ACLSyntaxException(error.message);
  }

  const {documentPropertyMap} = categorizePropertyMap(propertyMap);

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

  const replacers = await buildExpressionReplacers(
    schema,
    documentPropertyMap,
    resolve,
    hashSecret
  );

  let aclResult;

  try {
    aclResult = expression.runWithReplacers(
      schema.acl.write,
      {
        auth,
        document: fullDocument
      },
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

export function applyFieldLevelAcl(
  document: any,
  properties: Record<string, {acl?: string}>,
  user: any
): any {
  if (!document || !properties) {
    return document;
  }

  const result = {...document};

  for (const key in properties) {
    const acl = properties[key].acl;

    if (acl) {
      const allowed = expression.run(acl, {auth: user}, "match");

      if (!allowed) {
        delete result[key];
      }
    }
  }

  return result;
}

export function authIdToString(req: any) {
  if (req.user && req.user._id) {
    req.user._id = req.user._id.toString();
  }
  return req;
}
