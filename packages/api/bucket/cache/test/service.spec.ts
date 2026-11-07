import {Test} from "@nestjs/testing";
import {BucketCacheModule, BucketCacheService} from "@spica-server/bucket-cache";
import {contractSuite} from "@spica-server/database-testing";
import {BUCKET_REPOSITORY, BucketRepository} from "@spica-server/interface-bucket";
import {Cache} from "cache-manager";

contractSuite("Bucket Cache Service", engine => {
  let service: BucketCacheService;
  let cacheManager: Cache;
  let buckets: BucketRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [BucketCacheModule.register({ttl: null}), engine.module()],
      controllers: [],
      providers: []
    }).compile();

    module.createNestApplication();

    service = module.get(BucketCacheService);
    cacheManager = service["cacheManager"];
    buckets = module.get(BUCKET_REPOSITORY);
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

  it("should clear the bucket2 caches when bucket1 caches deleted because of the relation", async () => {
    const {_id: bucket1} = await buckets.insert({
      title: "bucket1",
      properties: {
        title: {
          type: "string"
        }
      }
    } as any);

    const {_id: bucket2} = await buckets.insert({
      title: "bucket2",
      properties: {
        rel: {
          type: "relation",
          bucketId: String(bucket1)
        }
      }
    } as any);

    const {_id: bucket3} = await buckets.insert({
      title: "bucket3",
      properties: {
        title: {
          type: "string"
        }
      }
    } as any);

    await cacheManager.set(`/bucket/${bucket1}/data`, [{title: "test1"}]);
    await cacheManager.set(`/bucket/${bucket2}/data`, [{title: "test2"}]);
    await cacheManager.set(`/bucket/${bucket3}/data`, [{title: "test3"}]);

    await service.invalidate(String(bucket1));

    const cacheKeys = await cacheManager.store.keys();
    expect(cacheKeys).toEqual([`/bucket/${bucket3}/data`]);

    const cacheResponses = await cacheManager.get(cacheKeys[0]);
    expect(cacheResponses).toEqual([{title: "test3"}]);
  });

  //@TODO: cron job does not fire the onTick method.
  xit("should clear cache at the end of day", async () => {
    await cacheManager.set(`/bucket/bucket1/data`, [{title: "test1"}]);
    await cacheManager.set(`/bucket/bucket2/data`, [{title: "test2"}]);

    jest.useFakeTimers();
    jest.setSystemTime(new Date(2020, 1, 1, 23, 59, 59, 0));

    jest.advanceTimersByTime(1000);

    const cacheKeys = await cacheManager.store.keys();
    expect(cacheKeys).toEqual([]);

    jest.useRealTimers();
  });
});
