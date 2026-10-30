import {diffBuckets} from "@spica-server/bucket-common";
import {Session} from "@spica-server/data-postgresql-orm";
import {Bucket, StoredBucket} from "@spica-server/interface-bucket";
import {
  createStatements,
  describeBucket,
  KeyChange,
  keyChangeOf,
  mainTableName,
  mergePlans,
  movesKeyValues,
  planUpdate,
  PrimaryKeyMetadata,
  relationTargets,
  RelationTargets,
  statementsOf,
  tryPrimaryKeyMetadata,
  UpdatePlan,
  withoutRelationsTo
} from "../../schema/index.js";
import {StoredBuckets} from "./stored-buckets.js";

export class SchemaPlanner {
  constructor(
    private readonly session: Session,
    private readonly stored: StoredBuckets
  ) {}

  async statementsToCreate(bucket: StoredBucket) {
    return createStatements(
      describeBucket(String(bucket._id), bucket, await this.targetsOf(bucket))
    );
  }

  async statementsToReplace(previous: StoredBucket, next: StoredBucket) {
    const bucketId = String(next._id);
    if (!(await this.session.tableExists(mainTableName(bucketId)))) {
      return this.statementsToCreate(next);
    }

    const diff = diffBuckets(previous, next);
    if (!diff.fields.length && !diff.indexes.length && !diff.primary) {
      return [];
    }

    const previousMetadata = describeBucket(bucketId, previous, await this.targetsOf(previous));
    const nextMetadata = describeBucket(bucketId, next, await this.targetsOf(next));
    const keyChange = keyChangeOf(previousMetadata, nextMetadata);

    const plans = [planUpdate(previousMetadata, nextMetadata, keyChange)];
    if (keyChange && movesKeyValues(keyChange)) {
      plans.push(...(await this.plansOfReferrers(bucketId, keyChange)));
    }
    return statementsOf(mergePlans(plans));
  }

  async cleanupOfRelationsTo(bucketId: string) {
    const changed: StoredBucket[] = [];
    const statements: string[] = [];
    for (const other of await this.stored.all()) {
      const pruned = String(other._id) == bucketId ? null : withoutRelationsTo(other, bucketId);
      if (pruned) {
        const next = {...pruned, _id: other._id} as StoredBucket;
        statements.push(...(await this.statementsToReplace(other, next)));
        changed.push(next);
      }
    }
    return {changed, statements};
  }

  private async plansOfReferrers(bucketId: string, keyChange: KeyChange) {
    const plans: UpdatePlan[] = [];
    for (const other of await this.stored.all()) {
      const otherId = String(other._id);
      if (otherId == bucketId || !relationTargets(other.properties).includes(bucketId)) {
        continue;
      }
      if (!(await this.session.tableExists(mainTableName(otherId)))) {
        continue;
      }
      const stored = await this.targetsOf(other);
      const resolveWith =
        (primaryKey: PrimaryKeyMetadata): RelationTargets =>
        id =>
          id == bucketId ? {table: keyChange.table, primaryKey} : stored(id);
      plans.push(
        planUpdate(
          describeBucket(otherId, other, resolveWith(keyChange.previous)),
          describeBucket(otherId, other, resolveWith(keyChange.next)),
          keyChange
        )
      );
    }
    return plans;
  }

  private async targetsOf(bucket: Bucket): Promise<RelationTargets> {
    const resolved = new Map<string, {table: string; primaryKey: PrimaryKeyMetadata}>();
    for (const targetId of relationTargets(bucket.properties)) {
      if (targetId == String(bucket._id)) {
        continue;
      }
      const target = await this.stored.find(targetId);
      const primaryKey = target && tryPrimaryKeyMetadata(target);
      if (primaryKey) {
        resolved.set(targetId, {table: mainTableName(targetId), primaryKey});
      }
    }
    return targetId => resolved.get(targetId);
  }
}
