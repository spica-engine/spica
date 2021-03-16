import {
  CacheInterceptor,
  CACHE_MANAGER,
  CallHandler,
  ExecutionContext,
  Inject,
  mixin,
  NestInterceptor,
  Optional,
  Type
} from "@nestjs/common";
import {Reflector} from "@nestjs/core";
import {Observable} from "rxjs";
import {tap} from "rxjs/operators";
import {BucketCacheService} from ".";

class BucketCacheInterceptor extends CacheInterceptor {
  constructor(@Optional() @Inject(CACHE_MANAGER) cacheManager: any, reflector: Reflector) {
    super(cacheManager, reflector);
  }

  trackBy(context: ExecutionContext): string | undefined {
    if (!this.cacheManager) {
      return undefined;
    }

    const req = context.switchToHttp().getRequest();
    const path = req.originalUrl;
    const language = req.get("accept-language");

    return path + "&accept-language=" + language;
  }
}

class BucketCacheInvalidationInterceptor implements NestInterceptor {
  constructor(
    @Optional() @Inject(CACHE_MANAGER) private cacheManager: any,
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
