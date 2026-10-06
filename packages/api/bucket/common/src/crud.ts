import {BaseCollection, ObjectId, ReturnDocument} from "@spica-server/database";
import {ICollection} from "@spica-server/database-driver";
import * as expression from "@spica-server/bucket-expression";
import {
  createRelationMap,
  getRelationPipeline,
  resetNonOverlappingPathsInRelationMap
} from "./relation.js";
import {getUpdateQueryForPatch} from "@spica-server/core-patch";
import {
  ACLSyntaxException,
  BadRequestException,
  DatabaseException,
  ForbiddenException
} from "./exception.js";
import {categorizePropertyMap} from "./helpers.js";
import {BucketPipelineBuilder} from "./pipeline.builder.js";
import {buildReadPlan} from "./read-plan.js";
import {resolveCandidateRelations} from "./resolve-candidate.js";
import {PipelineBuilder, executePaginationPlan} from "@spica-server/database-pipeline";
import {
  CrudOptions,
  CrudParams,
  CrudFactories,
  CrudPagination,
  RelationMap
} from "@spica-server/interface-bucket-common";
import {Bucket, LimitExceedBehaviours, BucketDocument} from "@spica-server/interface-bucket";
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

  /**
   * **The neutral read path.**
   *
   * The pipeline below builds `$expr`, `$lookup`, `$cond` and `$facet`; those are decisions about
   * **how** the driver will do the work, so they are taken out of the plan. `ReadPlan` carries
   * **what** is wanted, compiling it is the driver's job.
   *
   * The MongoDB leg stays on the pipeline: there is a working implementation there and `read()` does not
   * exist yet; changing it would be a needless regression risk. The same
   * path is taken when no plan can be produced (field-level ACL, a raw Mongo JSON filter) —
   * `buildReadPlan` reports that with `undefined` rather than giving a silently wrong result.
   */
  /**
   * The capability is queried through a narrow cast: `ICollection` does not carry `db`, but every
   * collection that arrives here is a `BaseCollection` (that is, a `DelegatingCollection`) and that
   * exposes a `readonly db`. The alternative was adding `capabilities` to `ICollection` — widening the
   * contract for this would be premature.
   *
   * Checking whether the method **exists** is not enough: `read` is now always present on the bridge and
   * raises at runtime on a driver that does not implement it. The distinction is a mechanism difference,
   * so the capability is consulted — the same distinction was used for `explain()` and TTL in this
   * effort.
   */
  const backend = (collection as unknown as {db?: {capabilities?: {backend?: string}}}).db
    ?.capabilities?.backend;

  if (backend && backend !== "mongodb") {
    const plan = await buildReadPlan({
      schema,
      params,
      options,
      factories,
      preferences: await factories.preference(),
      hashSecret
    });

    if (plan) {
      const result = await (collection as any).read(plan).catch(error => {
        throw new DatabaseException(error.message);
      });

      const documents = encryptionSecret
        ? result.data.map(doc =>
            decryptDocumentFields(doc as any, schema, encryptionSecret, factories.schema)
          )
        : result.data;

      return options.paginate ? {meta: {total: result.total ?? 0}, data: documents} : documents;
    }
  }

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

  const plan = relationPathResolvedPipeline.buildPaginationPlan(seeking, () =>
    collection.estimatedDocumentCount()
  );

  if (options.paginate) {
    const result = await executePaginationPlan<T>(collection, plan).catch(error => {
      throw new DatabaseException(error.message);
    });
    if (encryptionSecret) {
      result.data = result.data.map(doc =>
        decryptDocumentFields(doc as any, schema, encryptionSecret, factories.schema)
      ) as T[];
    }
    return result;
  }

  const documents = await collection
    .aggregate<T>(plan.dataPipeline)
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
  schemaResolver: (id: string | ObjectId) => Promise<Bucket> | Bucket,
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
    collection: (schema: Bucket) => ICollection<any>;
    schema: (id: string | ObjectId) => Promise<Bucket> | Bucket;
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
    collection: (schema: Bucket) => ICollection<any>;
    schema: (id: string | ObjectId) => Promise<Bucket> | Bucket;
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
    collection: (schema: Bucket) => ICollection<any>;
    schema: (id: string | ObjectId) => Promise<Bucket> | Bucket;
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
    collection: (schema: Bucket) => ICollection<BucketDocument>;
    schema: (schema: string | ObjectId) => Promise<Bucket> | Bucket;
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
  resolve: (id: string) => Promise<Bucket> | Bucket,
  document: BucketDocument,
  collection: ICollection<unknown>,
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

  /**
   * The candidate document's relations are resolved **in the application layer**.
   *
   * The collection used to be used as a calculation engine:
   * `[{$limit: 1}, {$replaceWith: {$literal: document}}, ...$lookup]` — an arbitrary row was taken and
   * thrown away, the candidate document was put in its place and the relations were resolved with
   * `$lookup`. The rationale and its two defects (working on Mongo only, and **returning `null` on Mongo
   * too when the collection is empty**) are written down in `resolveCandidateRelations`.
   */
  const fullDocument = await resolveCandidateRelations(
    document as unknown as Record<string, unknown>,
    documentRelationMap,
    (target, ids) =>
      collection.collection(target).find({_id: {$in: ids}} as any) as Promise<
        Record<string, unknown>[]
      >
  ).catch(error => {
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
