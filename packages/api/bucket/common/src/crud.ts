import {BaseCollection, ReturnDocument} from "@spica-server/database";
import {ids} from "@spica-server/data";
import {Id} from "@spica-server/interface-data";
import * as expression from "@spica-server/bucket-expression";
import {createRelationMap, getRelationPipeline} from "./relation.js";
import {getUpdateQueryForPatch} from "@spica-server/core-patch";
import {
  ACLSyntaxException,
  BadRequestException,
  DatabaseException,
  ForbiddenException
} from "./exception.js";
import {categorizePropertyMap} from "./helpers.js";
import {CrudFactories} from "@spica-server/interface-bucket-common";
import {Bucket, LimitExceedBehaviours, BucketDocument} from "@spica-server/interface-bucket";
import {decryptDocumentFields} from "./decrypt.js";
import {buildExpressionReplacers} from "./expression.filter.js";

export async function insertDocument(
  schema: Bucket,
  document: BucketDocument,
  params: {
    req: any;
    applyAcl?: boolean;
  },
  factories: {
    collection: (schema: Bucket) => BaseCollection<any>;
    schema: (id: string | Id) => Promise<Bucket> | Bucket;
    deleteOne: (documentId: Id) => Promise<void>;
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
    schema: (id: string | Id) => Promise<Bucket> | Bucket;
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
    schema: (id: string | Id) => Promise<Bucket> | Bucket;
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
  documentId: string | Id,
  params: {
    req: any;
    applyAcl?: boolean;
  },
  factories: {
    collection: (schema: Bucket) => BaseCollection<BucketDocument>;
    schema: (schema: string | Id) => Promise<Bucket> | Bucket;
  },
  hashSecret?: string,
  encryptionSecret?: string
) {
  // GraphQL's ObjectId scalar passes null for an invalid literal, which has always deleted nothing.
  if (documentId == null) {
    return;
  }

  const collection = factories.collection(schema);

  const documentIdType = await ids().forBucket(schema._id.toString());
  const document = await collection.findOne({_id: documentIdType.parse(documentId)});

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
