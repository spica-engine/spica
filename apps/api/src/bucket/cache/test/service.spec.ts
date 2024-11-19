import {Test} from "@nestjs/testing";
import {BucketCacheModule, BucketCacheService} from "@spica/api/src/bucket/cache";
import {DatabaseTestingModule, ObjectId} from "@spica/database";
import {Cache} from "cache-manager";

describe("Bucket Cache Service", () => {
  let service: BucketCacheService;
  let cacheManager: Cache;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [BucketCacheModule.register({ttl: null}), DatabaseTestingModule.standalone()],
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

  it("should clear the bucket2 caches when bucket1 caches deleted because of the relation", async () => {
    const {insertedId: bucket1} = await service["db"].collection("buckets").insertOne({
      properties: {
        title: {
          type: "string"
        }
      }
    });

    const {insertedId: bucket2} = await service["db"].collection("buckets").insertOne({
      properties: {
        rel: {
          type: "relation",
          bucketId: bucket1.toHexString()
        }
      }
    });

    const {insertedId: bucket3} = await service["db"].collection("buckets").insertOne({
      properties: {
        title: {
          ttype: "string"
        }
      }
    });

    await cacheManager.set(`/bucket/${bucket1}/data`, [{title: "test1"}]);
    await cacheManager.set(`/bucket/${bucket2}/data`, [{title: "test2"}]);
    await cacheManager.set(`/bucket/${bucket3}/data`, [{title: "test3"}]);

    await service.invalidate(bucket1.toHexString());

    const cacheKeys = await cacheManager.store.keys();
    expect(cacheKeys).toEqual([`/bucket/${bucket3}/data`]);

    const cacheResponses = await cacheManager.get(cacheKeys[0]);
    expect(cacheResponses).toEqual([{title: "test3"}]);
  });

  //@TODO: cron job does not fire the onTick method.
  xit("should clear cache at the end of day", async () => {
    await cacheManager.set(`/bucket/bucket1/data`, [{title: "test1"}]);
    await cacheManager.set(`/bucket/bucket2/data`, [{title: "test2"}]);

    const clock = jasmine.clock();
    clock.install();
    clock.mockDate(new Date(2020, 1, 1, 23, 59, 59, 0));

    clock.tick(1000);

    const cacheKeys = await cacheManager.store.keys();
    expect(cacheKeys).toEqual([]);
  });
});
