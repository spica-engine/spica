import {BadRequestException, Inject, Injectable} from "@nestjs/common";
import {diffBuckets} from "@spica-server/bucket-common";
import {Orm, quote, Session} from "@spica-server/data-postgresql-orm";
import {Id} from "@spica-server/interface-data";
import {Bucket, BucketSchemaManager, StoredBucket} from "@spica-server/interface-bucket";
import {buckets} from "../../entities/index.js";
import {ORM} from "../../orm.js";
import {decodeBucket, encodeBucket} from "./rows.js";
import {
  BucketSchemaError,
  createStatements,
  describeBucket,
  mainTableName,
  updateStatements
} from "../../schema/index.js";

const SCHEMA_LOCK = "bucket-schema";

@Injectable()
export class PostgresBucketSchemaManager implements BucketSchemaManager {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  async create(bucket: Bucket, onSaved: (saved: StoredBucket) => void) {
    const inserted = await this.inTransaction(async session => {
      const stored = decodeBucket(
        await session.insert(buckets, encodeBucket(bucket))
      ) as StoredBucket;
      await this.execute(session, createStatements(describeBucket(String(stored._id), stored)));
      return stored;
    });
    onSaved(inserted);
    return inserted;
  }

  async replace(id: Id, bucket: Bucket, onSaved: (saved: StoredBucket) => void) {
    const replaced = await this.inTransaction(async session => {
      const previous = decodeBucket(await session.findById(buckets, id)) as StoredBucket | null;
      if (!previous) {
        return null;
      }
      const result = decodeBucket(
        await session.replaceById(buckets, id, encodeBucket(bucket))
      ) as StoredBucket | null;
      const next = {...bucket, _id: id} as StoredBucket;
      await this.execute(session, await this.statementsToReplace(session, previous, next));
      return result;
    });
    if (replaced) {
      onSaved({...bucket, _id: id} as StoredBucket);
    }
    return replaced;
  }

  async drop(id: Id, onSaved: (dropped: StoredBucket) => void) {
    const dropped = await this.inTransaction(async session => {
      const deleted = decodeBucket(await session.deleteById(buckets, id)) as StoredBucket | null;
      if (deleted) {
        await this.execute(session, await this.dropStatements(session, String(id)));
      }
      return deleted;
    });
    if (dropped) {
      onSaved(dropped);
    }
    return dropped;
  }

  private async statementsToReplace(session: Session, previous: StoredBucket, next: StoredBucket) {
    const bucketId = String(next._id);
    const {rows} = await session.raw("SELECT to_regclass($1) AS main", [
      quote(mainTableName(bucketId))
    ]);
    if (!rows[0].main) {
      return createStatements(describeBucket(bucketId, next));
    }
    return updateStatements(
      describeBucket(bucketId, previous),
      describeBucket(bucketId, next),
      diffBuckets(previous, next)
    );
  }

  private async dropStatements(session: Session, bucketId: string) {
    const {rows} = await session.raw<{table_name: string}>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND starts_with(table_name, $1)",
      [mainTableName(bucketId)]
    );
    return rows.map(row => `DROP TABLE ${quote(row.table_name)} CASCADE`);
  }

  private async execute(session: Session, statements: string[]) {
    for (const statement of statements) {
      await session.raw(statement);
    }
  }

  private async inTransaction<T>(work: (session: Session) => Promise<T>) {
    try {
      return await this.orm.transaction(async session => {
        await session.lockTransaction(SCHEMA_LOCK);
        return work(session);
      });
    } catch (error) {
      if (error instanceof BucketSchemaError) {
        throw new BadRequestException(error.problems.join("\n"));
      }
      if (/^2[23]/.test(error?.code)) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
