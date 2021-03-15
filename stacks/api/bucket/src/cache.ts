import {CacheInterceptor, ExecutionContext, Injectable} from "@nestjs/common";
import {CACHE_MANAGER, Inject} from "@nestjs/common";
import {Cache} from "cache-manager";

@Injectable()
export class BucketCacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async invalidate(bucketId: string) {
    const keys: string[] = await this.cacheManager.store.keys();
    const targets = keys.filter(key => key.startsWith(`/bucket/${bucketId}`));
    console.log(targets);
    return this.cacheManager.store.del(...targets);
  }
}

@Injectable()
export class BucketCacheInterceptor extends CacheInterceptor {
  trackBy(context: ExecutionContext): string | undefined {
    const req = context.switchToHttp().getRequest();
    const path = req.path;
    const language = req.get("accept-language");
    return path + "&accept-language=" + language;
  }
}
