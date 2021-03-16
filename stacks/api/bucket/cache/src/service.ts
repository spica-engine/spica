import {CACHE_MANAGER, Inject, Injectable} from "@nestjs/common";
import {Cache} from "cache-manager";

@Injectable()
export class BucketCacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async invalidate(bucketId: string) {
    const keys: string[] = await this.cacheManager.store.keys();
    const targets = keys.filter(key => key.startsWith(`/bucket/${bucketId}`));
    return this.cacheManager.store.del(...targets);
  }
}
