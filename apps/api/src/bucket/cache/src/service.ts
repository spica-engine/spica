import {Inject, Injectable} from "@nestjs/common";
import {DatabaseService} from "@spica-server/database";
import cron from "cron";
import {CACHE_MANAGER, Cache} from "@nestjs/cache-manager";

@Injectable()
export class BucketCacheService {
  invalidateJob;

  // to prevent infinite loop while clearing bucket caches which has cross-relation or self-relation
  invalidatedBucketIds = new Set();

  // Track cached keys locally since cache-manager v6 (Keyv) does not expose store.keys()
  private cachedKeys = new Set<string>();

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

  trackKey(key: string) {
    this.cachedKeys.add(key);
  }

  untrackKey(key: string) {
    this.cachedKeys.delete(key);
  }

  hasKey(key: string): boolean {
    return this.cachedKeys.has(key);
  }

  private async getRelatedBucketIds(bucketId: string): Promise<string[]> {
    return this.db
      .collection("buckets")
      .aggregate([
        {
          $project: {
            properties: {
              $objectToArray: "$properties"
            }
          }
        },
        {
          $match: {
            "properties.v.bucketId": bucketId
          }
        }
      ])
      .toArray()
      .then(buckets => buckets.map(bucket => bucket._id.toString()));
  }

  async reset(): Promise<void> {
    this.cachedKeys.clear();
    await this.cacheManager.reset();
  }

  async invalidate(bucketId: string) {
    this.invalidatedBucketIds.add(bucketId);

    let relatedBucketIds = await this.getRelatedBucketIds(bucketId);
    relatedBucketIds = relatedBucketIds.filter(id => !this.invalidatedBucketIds.has(id));
    for (const id of relatedBucketIds) {
      await this.invalidate(id);
    }

    const targets = [...this.cachedKeys].filter(key => key.startsWith(`/bucket/${bucketId}`));
    for (const target of targets) {
      await this.cacheManager.del(target);
      this.cachedKeys.delete(target);
    }
    this.invalidatedBucketIds.delete(bucketId);
  }
}
