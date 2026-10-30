import {BadRequestException, Inject, Injectable} from "@nestjs/common";
import {Orm, Session} from "@spica-server/data-postgresql-orm";
import {Id} from "@spica-server/interface-data";
import {Bucket, BucketSchemaManager, StoredBucket} from "@spica-server/interface-bucket";
import {ORM} from "../../orm.js";
import {BucketSchemaError, dropTablesStatements, mainTableName} from "../../schema/index.js";
import {SchemaPlanner} from "./schema-planner.js";
import {StoredBuckets} from "./stored-buckets.js";

const SCHEMA_LOCK = "bucket-schema";

@Injectable()
export class PostgresBucketSchemaManager implements BucketSchemaManager {
  constructor(@Inject(ORM) private readonly orm: Orm) {}

  async create(bucket: Bucket, onSaved: (saved: StoredBucket) => void) {
    const inserted = await this.inTransaction(async (session, stored, planner) => {
      const inserted = await stored.insert(bucket);
      await session.executeStatements(await planner.statementsToCreate(inserted));
      return inserted;
    });
    onSaved(inserted);
    return inserted;
  }

  async replace(id: Id, bucket: Bucket, onSaved: (saved: StoredBucket) => void) {
    const replaced = await this.inTransaction(async (session, stored, planner) => {
      const previous = await stored.find(id);
      if (!previous) {
        return null;
      }
      const result = await stored.replace(id, bucket);
      const statements = await planner.statementsToReplace(previous, {...bucket, _id: id});
      await session.executeStatements(statements);
      return result;
    });
    if (replaced) {
      onSaved({...bucket, _id: id} as StoredBucket);
    }
    return replaced;
  }

  async drop(
    id: Id,
    onSaved: (dropped: StoredBucket) => void,
    onRelatedChanged: (changed: StoredBucket) => void = () => {}
  ) {
    const result = await this.inTransaction(async (session, stored, planner) => {
      if (!(await stored.find(id))) {
        return null;
      }
      const cleanup = await planner.cleanupOfRelationsTo(String(id));
      for (const other of cleanup.changed) {
        await stored.replace(other._id, other);
      }
      await session.executeStatements(cleanup.statements);

      const dropped = await stored.delete(id);
      const tables = await session.tableNames({prefix: mainTableName(String(id))});
      await session.executeStatements(dropTablesStatements(tables));
      return {dropped, changed: cleanup.changed};
    });
    if (!result) {
      return null;
    }
    onSaved(result.dropped);
    result.changed.forEach(bucket => onRelatedChanged(bucket));
    return result.dropped;
  }

  private async inTransaction<T>(
    work: (session: Session, stored: StoredBuckets, planner: SchemaPlanner) => Promise<T>
  ) {
    try {
      return await this.orm.transaction(async session => {
        await session.lockTransaction(SCHEMA_LOCK);
        const stored = new StoredBuckets(session);
        return work(session, stored, new SchemaPlanner(session, stored));
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
