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
  KeyChange,
  keyChangeOf,
  mainTableName,
  mergePlans,
  movesKeyValues,
  planUpdate,
  PrimaryKeyMetadata,
  tryPrimaryKeyMetadata,
  relationTargets,
  RelationTargets,
  statementsOf,
  UpdatePlan,
  withoutRelationsTo
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
      const targets = await this.targetsOf(session, stored);
      await this.execute(
        session,
        createStatements(describeBucket(String(stored._id), stored, targets))
      );
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

  async drop(
    id: Id,
    onSaved: (dropped: StoredBucket) => void,
    onRelatedChanged: (changed: StoredBucket) => void = () => {}
  ) {
    const result = await this.inTransaction(async session => {
      const existing = await session.findById(buckets, id);
      if (!existing) {
        return null;
      }
      const changed = await this.dropRelationsTo(session, String(id));
      const dropped = decodeBucket(await session.deleteById(buckets, id)) as StoredBucket;
      await this.execute(session, await this.dropStatements(session, String(id)));
      return {dropped, changed};
    });
    if (!result) {
      return null;
    }
    onSaved(result.dropped);
    result.changed.forEach(bucket => onRelatedChanged(bucket));
    return result.dropped;
  }

  private async dropRelationsTo(session: Session, bucketId: string) {
    const all = (await session.findMany(buckets, {})).map(decodeBucket) as StoredBucket[];
    const changed: StoredBucket[] = [];
    for (const other of all) {
      const pruned = String(other._id) == bucketId ? null : withoutRelationsTo(other, bucketId);
      if (!pruned) {
        continue;
      }
      const next = {...pruned, _id: other._id} as StoredBucket;
      await session.replaceById(buckets, other._id, encodeBucket(pruned));
      await this.execute(session, await this.statementsToReplace(session, other, next));
      changed.push(next);
    }
    return changed;
  }

  private async targetsOf(session: Session, bucket: Bucket): Promise<RelationTargets> {
    const resolved = new Map<string, {table: string; primaryKey: PrimaryKeyMetadata}>();
    for (const targetId of relationTargets(bucket.properties)) {
      if (targetId == String(bucket._id)) {
        continue;
      }
      const target = decodeBucket(await session.findById(buckets, targetId)) as StoredBucket | null;
      const primaryKey = target && tryPrimaryKeyMetadata(target);
      if (primaryKey) {
        resolved.set(targetId, {table: mainTableName(targetId), primaryKey});
      }
    }
    return targetId => resolved.get(targetId);
  }

  private async statementsToReplace(session: Session, previous: StoredBucket, next: StoredBucket) {
    const bucketId = String(next._id);
    const exists = await this.tableExists(session, mainTableName(bucketId));
    if (!exists) {
      return createStatements(describeBucket(bucketId, next, await this.targetsOf(session, next)));
    }

    const diff = diffBuckets(previous, next);
    if (!diff.fields.length && !diff.indexes.length && !diff.primary) {
      return [];
    }

    const previousMetadata = describeBucket(
      bucketId,
      previous,
      await this.targetsOf(session, previous)
    );
    const nextMetadata = describeBucket(bucketId, next, await this.targetsOf(session, next));
    const keyChange = keyChangeOf(previousMetadata, nextMetadata);

    const plans = [planUpdate(previousMetadata, nextMetadata, keyChange)];
    if (keyChange && movesKeyValues(keyChange)) {
      plans.push(...(await this.plansOfReferrers(session, bucketId, keyChange)));
    }
    return statementsOf(mergePlans(plans));
  }

  private async plansOfReferrers(session: Session, bucketId: string, keyChange: KeyChange) {
    const all = (await session.findMany(buckets, {})).map(decodeBucket) as StoredBucket[];
    const target = (primaryKey: KeyChange["previous"]) => ({
      table: keyChange.table,
      primaryKey
    });
    const plans: UpdatePlan[] = [];

    for (const other of all) {
      const otherId = String(other._id);
      if (otherId == bucketId || !relationTargets(other.properties).includes(bucketId)) {
        continue;
      }
      if (!(await this.tableExists(session, mainTableName(otherId)))) {
        continue;
      }
      const resolveWith = async (primaryKey: KeyChange["previous"]) => {
        const stored = await this.targetsOf(session, other);
        return (id: string) => (id == bucketId ? target(primaryKey) : stored(id));
      };
      plans.push(
        planUpdate(
          describeBucket(otherId, other, await resolveWith(keyChange.previous)),
          describeBucket(otherId, other, await resolveWith(keyChange.next)),
          keyChange
        )
      );
    }
    return plans;
  }

  private async tableExists(session: Session, table: string) {
    const {rows} = await session.raw("SELECT to_regclass($1) AS found", [quote(table)]);
    return Boolean(rows[0].found);
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
