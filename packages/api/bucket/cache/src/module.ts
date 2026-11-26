import {DynamicModule, Module} from "@nestjs/common";
import {CacheModule} from "@nestjs/cache-manager";
import {Keyv} from "keyv";
import {provideRepository} from "@spica-server/data";
import {BUCKET_REPOSITORY} from "@spica-server/interface-bucket";
import {BucketCacheService} from "./service.js";
import {LruMap} from "./lru-map.js";

const MAX_ENTRIES = 100;

@Module({})
export class BucketCacheModule {
  static register(options: {ttl: number}): DynamicModule {
    const store = new Keyv({
      store: new LruMap(MAX_ENTRIES),
      useKeyPrefix: false,
      serialize: undefined,
      deserialize: undefined
    });
    const CoreCacheModule = CacheModule.register({stores: store, ttl: options.ttl});
    return {
      module: BucketCacheModule,
      imports: [CoreCacheModule],
      providers: [provideRepository(BUCKET_REPOSITORY), BucketCacheService],
      exports: [BucketCacheService, CoreCacheModule]
    };
  }
}
