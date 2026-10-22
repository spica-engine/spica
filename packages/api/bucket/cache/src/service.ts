import {Inject, Injectable} from "@nestjs/common";
import {BUCKET_REPOSITORY, BucketRepository} from "@spica-server/interface-bucket";
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
    @Inject(BUCKET_REPOSITORY) private buckets: BucketRepository
  ) {
    if (!this.invalidateJob) {
      this.invalidateJob = cron.CronJob.from({
        cronTime: "0 0 0 * * *",
        start: true,
        onTick: () => this.reset()
      });
    }
  }

  private getRelatedBucketIds(bucketId: string): Promise<string[]> {
    return this.buckets.findReferencing(bucketId);
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
