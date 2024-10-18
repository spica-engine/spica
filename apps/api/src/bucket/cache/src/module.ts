import {CacheModule, CacheModuleOptions, DynamicModule, Module} from "@nestjs/common";
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
