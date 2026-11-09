import {Inject, Injectable, Optional} from "@nestjs/common";
import {
  checkWriteRule,
  DatabaseException,
  decryptDocumentFields
} from "@spica-server/bucket-common";
import {Orm, quote, Session} from "@spica-server/data-postgresql-orm";
import {
  Bucket,
  BUCKET_DATA_LIMIT,
  BucketDocument,
  LimitExceedBehaviours
} from "@spica-server/interface-bucket";
import {
  BUCKET_QUERY,
  BucketInsertContext,
  BucketQueryFacade,
  BucketWriteContext,
  BucketWriteFacade,
  BucketWriteOptions,
  ReturnedDocument
} from "@spica-server/interface-bucket-common";
import {Id, RESULT_SHAPER, ResultShaper} from "@spica-server/interface-data";
import {keyIdType} from "../id.js";
import {ORM} from "../orm.js";
import {allBucketTables, countDocuments} from "../repositories/bucket/counts.js";
import {BucketMetadata, describeBucket, resolveRelationTargets} from "../schema/index.js";
import {RowSet} from "../shape/index.js";
import {translateWriteError, WriteOperation} from "./errors.js";
import {insertRows} from "./row-writer.js";
import {deleteRow, lockRowSet, patchRows, replaceRows} from "./row-updater.js";

@Injectable()
export class PostgresBucketWriteFacade implements BucketWriteFacade {
  constructor(
    @Inject(ORM) private readonly orm: Orm,
    @Inject(RESULT_SHAPER) private readonly shaper: ResultShaper,
    @Inject(BUCKET_QUERY) private readonly query: BucketQueryFacade,
    @Optional() @Inject(BUCKET_DATA_LIMIT) private readonly bucketDataLimit?: number
  ) {}

  async insert(
    bucket: Bucket,
    document: BucketDocument,
    options: BucketWriteOptions,
    context: BucketInsertContext
  ): Promise<BucketDocument> {
    if (options.applyAcl) {
      await checkWriteRule({bucket, document, auth: options.user, context, query: this.query});
    }

    const metadata = await this.describe(bucket, context);
    await this.makeRoom(bucket, metadata, context);

    const rowSet = await this.transact(metadata, "write", async session => {
      await this.assertWithinLimits(session, bucket, metadata);
      return insertRows(session, bucket, metadata, document);
    });

    return this.shape(bucket, metadata, rowSet, context);
  }

  async replace(
    bucket: Bucket,
    document: BucketDocument,
    options: BucketWriteOptions & {returnDocument?: ReturnedDocument},
    context: BucketWriteContext
  ): Promise<BucketDocument | null> {
    return this.update(bucket, document, options, context, (session, metadata, previous) =>
      replaceRows(session, bucket, metadata, document, previous)
    );
  }

  async patch(
    bucket: Bucket,
    document: BucketDocument,
    patch: object,
    options: BucketWriteOptions & {returnDocument?: ReturnedDocument},
    context: BucketWriteContext
  ): Promise<BucketDocument | null> {
    return this.update(bucket, document, options, context, (session, metadata, previous) =>
      patchRows(session, bucket, metadata, document, patch as Record<string, unknown>, previous)
    );
  }

  async delete(
    bucket: Bucket,
    documentId: string | Id,
    options: BucketWriteOptions,
    context: BucketWriteContext
  ): Promise<BucketDocument | undefined> {
    if (documentId === null || documentId === undefined) {
      return undefined;
    }

    const metadata = await this.describe(bucket, context);
    const key = keyIdType(metadata.primaryKey.type).parse(documentId);

    const deleted = await this.transact(metadata, "delete", async session => {
      const previous = await lockRowSet(session, metadata, key);
      if (previous && options.applyAcl) {
        const document = await this.shapeRows(bucket, previous);
        await checkWriteRule({bucket, document, auth: options.user, context, query: this.query});
      }
      if (previous) {
        await deleteRow(session, metadata, previous);
      }
      return previous;
    });

    return deleted && this.shape(bucket, metadata, deleted, context);
  }

  private async update(
    bucket: Bucket,
    document: BucketDocument,
    options: BucketWriteOptions & {returnDocument?: ReturnedDocument},
    context: BucketWriteContext,
    write: (session: Session, metadata: BucketMetadata, previous: RowSet) => Promise<RowSet>
  ): Promise<BucketDocument | null> {
    if (options.applyAcl) {
      await checkWriteRule({bucket, document, auth: options.user, context, query: this.query});
    }

    const metadata = await this.describe(bucket, context);
    const key = document[metadata.primaryKey.field];

    const changed = await this.transact(metadata, "write", async session => {
      const previous = await lockRowSet(session, metadata, key);
      return previous && {previous, current: await write(session, metadata, previous)};
    });

    if (!changed) {
      return null;
    }
    const returned = options.returnDocument == "after" ? changed.current : changed.previous;
    return this.shape(bucket, metadata, returned, context);
  }

  private async transact<T>(
    metadata: BucketMetadata,
    operation: WriteOperation,
    work: (session: Session) => Promise<T>
  ): Promise<T> {
    try {
      return await this.orm.transaction(work);
    } catch (error) {
      throw translateWriteError(error, metadata, operation);
    }
  }

  private async describe(bucket: Bucket, context: BucketWriteContext) {
    const targets = await resolveRelationTargets(bucket, async id => context.resolveSchema(id));
    return describeBucket(String(bucket._id), bucket, targets);
  }

  private async makeRoom(bucket: Bucket, metadata: BucketMetadata, context: BucketInsertContext) {
    const settings = bucket.documentSettings;
    if (settings?.limitExceedBehaviour != LimitExceedBehaviours.REMOVE || !settings.countLimit) {
      return;
    }

    const surplus =
      (await countDocuments(this.orm, [metadata.main.name])) + 1 - settings.countLimit;
    if (surplus <= 0) {
      return;
    }

    const {column, type} = metadata.primaryKey;
    const {rows} = await this.orm.raw(
      `SELECT ${quote(column)} AS key FROM ${quote(metadata.main.name)} ORDER BY ${quote(column)} ASC LIMIT $1`,
      [surplus]
    );
    for (const {key} of rows) {
      await context.deleteOne(keyIdType(type).parse(key) as Id);
    }
  }

  private async assertWithinLimits(session: Session, bucket: Bucket, metadata: BucketMetadata) {
    if (this.bucketDataLimit) {
      const total = await countDocuments(session, await allBucketTables(session));
      if (total + 1 > this.bucketDataLimit) {
        throw new DatabaseException("Total bucket-data limit exceeded");
      }
    }

    const countLimit = bucket.documentSettings?.countLimit;
    if (countLimit && (await countDocuments(session, [metadata.main.name])) + 1 > countLimit) {
      throw new DatabaseException("Maximum number of documents has been reached");
    }
  }

  private shapeRows(bucket: Bucket, rowSet: RowSet): Promise<BucketDocument> {
    return this.shaper.shape<RowSet, BucketDocument>(
      {kind: "bucket", bucketId: String(bucket._id)},
      rowSet
    );
  }

  private async shape(
    bucket: Bucket,
    metadata: BucketMetadata,
    rowSet: RowSet,
    context: BucketWriteContext
  ): Promise<BucketDocument> {
    const saved = await this.shapeRows(bucket, rowSet);
    return context.encryptionSecret
      ? decryptDocumentFields(
          saved,
          bucket,
          context.encryptionSecret,
          context.resolveSchema,
          String(saved[metadata.primaryKey.field])
        )
      : saved;
  }
}
