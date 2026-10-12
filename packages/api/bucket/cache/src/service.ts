import {Inject, Injectable} from "@nestjs/common";
import {DatabaseService} from "@spica-server/database";
import cron from "cron";
import {CACHE_MANAGER} from "@nestjs/cache-manager";
import {Cache} from "cache-manager";

@Injectable()
export class BucketCacheService {
  invalidateJob;

  // to prevent infinite loop while clearing bucket caches which has cross-relation or self-relation
  invalidatedBucketIds = new Set();

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private db: DatabaseService
  ) {
    if (!this.invalidateJob) {
      this.invalidateJob = cron.CronJob.from({
        cronTime: "0 0 0 * * *",
        start: true,
        onTick: () => this.reset()
      });
    }
  }

  /**
   * The ids of the buckets that **have a relation to** this bucket — the filtering happens **in the
   * application layer**.
   *
   * An aggregation used to run with `$objectToArray` plus a `$match` on a nested array path. That chain's
   * only job was asking the database "is there anything in the properties map whose `bucketId` is this";
   * the schemas number in the dozens and are read anyway. The same decision was made for
   * `provideLanguageFinalizer` (R65) and `function/crud` (R70): the right move is to **remove** a
   * Mongo-specific escape hatch rather than move it into a finite compiler.
   *
   * This defect was **silent** on PostgreSQL: the computed expression of the `$project` was not
   * recognized, was ignored, and every column came back; then the `$match` looked at the nested array path
   * and found nothing. So the cache of the related buckets was **never** cleared and two tests passed on
   * wrong data. Tightening `$project` to comply with K-4 made it loud.
   */
  private async getRelatedBucketIds(bucketId: string): Promise<string[]> {
    const buckets = await this.db.collection("buckets").find();

    return buckets
      .filter(bucket =>
        Object.values(bucket.properties || {}).some(
          (property: any) => property?.bucketId === bucketId
        )
      )
      .map(bucket => bucket._id.toString());
  }

  reset() {
    return this.cacheManager.reset();
  }

  async invalidate(bucketId: string) {
    this.invalidatedBucketIds.add(bucketId);

    let relatedBucketIds = await this.getRelatedBucketIds(bucketId);
    relatedBucketIds = relatedBucketIds.filter(id => !this.invalidatedBucketIds.has(id));
    for (const id of relatedBucketIds) {
      await this.invalidate(id);
    }

    const keys: string[] = await this.cacheManager.store.keys();
    const targets = keys.filter(key => key.startsWith(`/bucket/${bucketId}`));
    for (const target of targets) {
      await this.cacheManager.store.del(target);
    }
    this.invalidatedBucketIds.delete(bucketId);
  }
}
