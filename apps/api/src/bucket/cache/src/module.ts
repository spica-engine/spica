import {DynamicModule, Module} from "@nestjs/common";
import {CacheModule, CacheModuleOptions} from "@nestjs/cache-manager";
import {BucketCacheService} from "./service";

@Module({})
export class BucketCacheModule {
  static register(options: CacheModuleOptions): DynamicModule {
    const CoreCacheModule = CacheModule.register(options);
    return {
      module: BucketCacheModule,
      imports: [CoreCacheModule],
      providers: [BucketCacheService],
      exports: [BucketCacheService, CoreCacheModule]
    };
  }
}
