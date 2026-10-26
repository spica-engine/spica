import {DynamicModule, Module} from "@nestjs/common";
import {CacheModule, CacheModuleOptions} from "@nestjs/cache-manager";
import {provideRepository} from "@spica-server/data";
import {BUCKET_REPOSITORY} from "@spica-server/interface-bucket";
import {BucketCacheService} from "./service.js";

@Module({})
export class BucketCacheModule {
  static register(options: CacheModuleOptions): DynamicModule {
    const CoreCacheModule = CacheModule.register(options);
    return {
      module: BucketCacheModule,
      imports: [CoreCacheModule],
      providers: [provideRepository(BUCKET_REPOSITORY), BucketCacheService],
      exports: [BucketCacheService, CoreCacheModule]
    };
  }
}
