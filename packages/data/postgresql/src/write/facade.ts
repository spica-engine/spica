import {Inject, Injectable, Optional} from "@nestjs/common";
import {checkWriteRule, DatabaseException} from "@spica-server/bucket-common";
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
  BucketWriteOptions
} from "@spica-server/interface-bucket-common";
import {Id, RESULT_SHAPER, ResultShaper} from "@spica-server/interface-data";
import {keyIdType} from "../id.js";
import {ORM} from "../orm.js";
import {allBucketTables, countDocuments} from "../repositories/bucket/counts.js";
import {BucketMetadata, describeBucket, resolveRelationTargets} from "../schema/index.js";
import {RowSet} from "../shape/index.js";
import {insertRows} from "./row-writer.js";

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

    const rowSet = await this.orm.transaction(async session => {
      await this.assertWithinLimits(session, bucket, metadata);
      return insertRows(session, bucket, metadata, document);
    });

    return this.shape(bucket, rowSet);
  }

  async replace(): Promise<BucketDocument | null> {
    throw new Error("Replacing documents is not supported on PostgreSQL yet.");
  }

  async patch(): Promise<BucketDocument | null> {
    throw new Error("Patching documents is not supported on PostgreSQL yet.");
  }

  async delete(): Promise<BucketDocument | undefined> {
    throw new Error("Deleting documents is not supported on PostgreSQL yet.");
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

  private shape(bucket: Bucket, rowSet: RowSet): Promise<BucketDocument> {
    return this.shaper.shape({kind: "bucket", bucketId: String(bucket._id)}, rowSet);
  }
}
