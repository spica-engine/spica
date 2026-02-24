import {
  CallHandler,
  ExecutionContext,
  Inject,
  mixin,
  NestInterceptor,
  Optional,
  Type
} from "@nestjs/common";
import {Observable} from "rxjs";
import {tap} from "rxjs/operators";
import {BucketCacheService} from "./service";
import {CacheInterceptor, CACHE_MANAGER, Cache} from "@nestjs/cache-manager";
import {Reflector} from "@nestjs/core";

class BucketCacheInterceptor extends CacheInterceptor {
  constructor(
    @Optional() @Inject(CACHE_MANAGER) cacheManager: Cache,
    @Optional() @Inject() reflector: Reflector,
    @Optional() private bucketCacheService: BucketCacheService
  ) {
    super(cacheManager, reflector);
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const key = this.trackBy(context);

    // Prune stale key if the cache entry expired via TTL
    if (key && this.bucketCacheService?.hasKey(key)) {
      const cached = await this.cacheManager.get(key);
      if (cached === undefined) {
        this.bucketCacheService.untrackKey(key);
      }
    }

    const result$ = await super.intercept(context, next);
    if (key && this.bucketCacheService) {
      return result$.pipe(tap(() => this.bucketCacheService.trackKey(key)));
    }
    return result$;
  }

  trackBy(context: ExecutionContext): string | undefined {
    if (!this.cacheManager) {
      return undefined;
    }

    const req = context.switchToHttp().getRequest();
    const path = req.originalUrl;
    const language = req.get("accept-language");

    const key = path + "&accept-language=" + language;

    return key;
  }
}

class BucketCacheInvalidationInterceptor implements NestInterceptor {
  constructor(
    @Optional() @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Optional() private bucketCacheService: BucketCacheService
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>
  ): Observable<any> | Promise<Observable<any>> {
    return next.handle().pipe(
      tap(async () => {
        if (this.cacheManager) {
          const req = context.switchToHttp().getRequest();
          const bucketId = req.params.bucketId || req.params.id;

          if (!bucketId) {
            return;
          }

          await this.bucketCacheService.invalidate(bucketId);
        }
      })
    );
  }
}

export function registerCache(): Type<NestInterceptor> {
  return mixin(BucketCacheInterceptor);
}

export function invalidateCache(): Type<NestInterceptor> {
  return mixin(BucketCacheInvalidationInterceptor);
}
