import {Test} from "@nestjs/testing";
import {BucketCacheModule, BucketCacheService} from "@spica-server/bucket/cache";
import {CoreTestingModule} from "@spica-server/core/testing";
import {Cache} from "cache-manager";

describe("Bucket Cache Service", () => {
  let service: BucketCacheService;
  let cacheManager: Cache;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [CoreTestingModule, BucketCacheModule.register({ttl: 60})],
      controllers: [],
      providers: []
    }).compile();

    module.createNestApplication();

    service = module.get(BucketCacheService);
    cacheManager = service["cacheManager"];
  });

  it("should clear bucket1 caches", async () => {
    await cacheManager.set("/bucket/bucket1/data", [{title: "test1"}]);
    await cacheManager.set("/bucket/bucket2/data", [{title: "test2"}]);

    await service.invalidate("bucket1");

    const cacheKeys = await cacheManager.store.keys();
    expect(cacheKeys).toEqual(["/bucket/bucket2/data"]);

    const cacheResponses = await cacheManager.get(cacheKeys[0]);
    expect(cacheResponses).toEqual([{title: "test2"}]);
  });
});
