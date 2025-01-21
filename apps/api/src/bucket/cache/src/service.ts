import {CACHE_MANAGER, Inject, Injectable} from "@nestjs/common";
import {Cache} from "cache-manager";
import {DatabaseService} from "@spica-server/database";
import * as cron from "cron";

@Injectable()
export class BucketCacheService {
  invalidateJob;

  // to prevent infinite loop while clearing bucket caches which has cross-relation or self-relation
  invalidatedBucketIds = new Set();

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache, private db: DatabaseService) {
    if (!this.invalidateJob) {
      this.invalidateJob = cron.CronJob.from({
        cronTime: "0 0 0 * * *",
        start: true,
        onTick: () => this.reset()
      });
    }
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
    await this.cacheManager.store.del(...targets);
    this.invalidatedBucketIds.delete(bucketId);
  }
}
