import {Inject, Injectable, Optional} from "@nestjs/common";
import * as expression from "@spica-server/bucket-expression";
import {
  ACLSyntaxException,
  BadRequestException,
  buildExpressionReplacers,
  categorizePropertyMap,
  createRelationMap,
  DatabaseException,
  decryptDocumentFields,
  ForbiddenException
} from "@spica-server/bucket-common";
import {getUpdateQueryForPatch} from "@spica-server/core-patch";
import {BaseCollection, DatabaseService, ReturnDocument} from "@spica-server/database";
import {
  Bucket,
  BUCKET_DATA_LIMIT,
  BucketDocument,
  LimitExceedBehaviours
} from "@spica-server/interface-bucket";
import {
  BucketInsertContext,
  BucketWriteContext,
  BucketWriteFacade,
  BucketWriteOptions,
  ReturnedDocument
} from "@spica-server/interface-bucket-common";
import {ids} from "@spica-server/data";
import {Id, RESULT_SHAPER, ResultShaper} from "@spica-server/interface-data";
import {getRelationPipeline} from "./stages.js";
import {bucketDataCollection} from "./collections.js";

const returnDocuments: {[key in ReturnedDocument]: ReturnDocument} = {
  before: ReturnDocument.BEFORE,
  after: ReturnDocument.AFTER
};

@Injectable()
export class MongoBucketWriteFacade implements BucketWriteFacade {
  constructor(
    private readonly db: DatabaseService,
    @Inject(RESULT_SHAPER) private readonly shaper: ResultShaper,
    @Optional() @Inject(BUCKET_DATA_LIMIT) private readonly bucketDataLimit?: number
  ) {}

  async insert(
    bucket: Bucket,
    document: BucketDocument,
    options: BucketWriteOptions,
    context: BucketInsertContext
  ): Promise<BucketDocument> {
    const collection = this.collection(bucket);

    if (options.applyAcl) {
      await executeWriteRule(
        bucket,
        document,
        // unlike others, we have to run this pipeline against buckets in case the target
        // collection is empty.
        collection.collection("buckets"),
        options.user,
        context
      );
    }
    if (
      bucket.documentSettings &&
      bucket.documentSettings.limitExceedBehaviour == LimitExceedBehaviours.REMOVE
    ) {
      const documentCount = await collection.estimatedDocumentCount();
      const diff = documentCount + 1 - bucket.documentSettings.countLimit;
      for (let i = 0; i < diff; i++) {
        const oldestDocument = await collection
          .aggregate<BucketDocument>([{$sort: {_id: 1}}, {$limit: 1}])
          .next();
        await context.deleteOne(oldestDocument._id);
      }
    }

    const inserted = await collection.insertOne(document).catch(handleWriteErrors);

    return this.result(bucket, inserted, context);
  }

  async replace(
    bucket: Bucket,
    document: BucketDocument,
    options: BucketWriteOptions & {returnDocument?: ReturnedDocument},
    context: BucketWriteContext
  ): Promise<BucketDocument | null> {
    const collection = this.collection(bucket);

    if (options.applyAcl) {
      await executeWriteRule(bucket, document, collection, options.user, context);
    }

    const documentId = document._id;
    delete document._id;

    const replaced = await collection
      .findOneAndReplace({_id: documentId}, document, {
        returnDocument: returnDocuments[options.returnDocument || "before"]
      })
      .catch(handleWriteErrors);

    return this.result(bucket, replaced, context);
  }

  async patch(
    bucket: Bucket,
    document: BucketDocument,
    patch: any,
    options: BucketWriteOptions & {returnDocument?: ReturnedDocument},
    context: BucketWriteContext
  ): Promise<BucketDocument | null> {
    const collection = this.collection(bucket);
    if (options.applyAcl) {
      await executeWriteRule(bucket, document, collection, options.user, context);
    }

    delete patch._id;

    const updateQuery = getUpdateQueryForPatch(patch, document);

    const patched = await collection
      .findOneAndUpdate({_id: document._id}, updateQuery, {
        returnDocument: returnDocuments[options.returnDocument || "before"]
      })
      .catch(handleWriteErrors);

    return this.result(bucket, patched, context);
  }

  async delete(
    bucket: Bucket,
    documentId: string | Id,
    options: BucketWriteOptions,
    context: BucketWriteContext
  ): Promise<BucketDocument | undefined> {
    // GraphQL's ObjectId scalar passes null for an invalid literal, which has always deleted nothing.
    if (documentId == null) {
      return;
    }

    const collection = this.collection(bucket);

    const documentIdType = await ids().forBucket(bucket._id.toString());
    const document = await collection.findOne({_id: documentIdType.parse(documentId)});

    if (!document) {
      return;
    }

    if (options.applyAcl) {
      await executeWriteRule(bucket, document, collection, options.user, context);
    }

    const deletedCount = await collection.deleteOne({_id: document._id});

    if (deletedCount == 1) {
      return this.result(bucket, document, context);
    }
  }

  private result<T extends BucketDocument | null>(
    bucket: Bucket,
    document: T,
    context: BucketWriteContext
  ): T {
    const decrypted =
      context.encryptionSecret && document
        ? (decryptDocumentFields(
            document,
            bucket,
            context.encryptionSecret,
            context.resolveSchema
          ) as T)
        : document;
    return this.shaper.shape({kind: "bucket", bucketId: bucket._id.toString()}, decrypted);
  }

  private collection(bucket: Bucket) {
    return bucketDataCollection(this.db, bucket, this.bucketDataLimit);
  }
}

async function executeWriteRule(
  bucket: Bucket,
  document: BucketDocument,
  collection: {aggregate: BaseCollection<unknown>["aggregate"]},
  auth: unknown,
  context: BucketWriteContext
) {
  let propertyMap = [];

  try {
    propertyMap = expression.extractPropertyMap(bucket.acl.write);
  } catch (error) {
    throw new ACLSyntaxException(error.message);
  }

  const {documentPropertyMap} = categorizePropertyMap(propertyMap);

  const documentRelationMap = await createRelationMap({
    properties: bucket.properties,
    paths: documentPropertyMap,
    resolve: context.resolveSchema
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
    bucket,
    documentPropertyMap,
    context.resolveSchema,
    context.hashSecret
  );

  let aclResult;

  try {
    aclResult = expression.runWithReplacers(
      bucket.acl.write,
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

function handleWriteErrors(error: any): never {
  if (error.code === 11000) {
    throw new BadRequestException(
      `Value of the property .${Object.keys(error.keyValue)[0]} should unique across all documents.`
    );
  }

  throw new DatabaseException(error.message);
}
