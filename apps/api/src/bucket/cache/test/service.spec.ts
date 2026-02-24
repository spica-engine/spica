import {Test} from "@nestjs/testing";
import {BucketCacheModule, BucketCacheService} from "@spica-server/bucket/cache";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {Cache} from "@nestjs/cache-manager";

describe("Bucket Cache Service", () => {
  let service: BucketCacheService;
  let cacheManager: Cache;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [BucketCacheModule.register({}), DatabaseTestingModule.standalone()],
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
    service.trackKey("/bucket/bucket1/data");
    service.trackKey("/bucket/bucket2/data");

    await service.invalidate("bucket1");

    expect(await cacheManager.get("/bucket/bucket1/data")).toBeUndefined();
    expect(await cacheManager.get("/bucket/bucket2/data")).toEqual([{title: "test2"}]);
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
    service.trackKey(`/bucket/${bucket1}/data`);
    service.trackKey(`/bucket/${bucket2}/data`);
    service.trackKey(`/bucket/${bucket3}/data`);

    await service.invalidate(bucket1.toHexString());

    expect(await cacheManager.get(`/bucket/${bucket1}/data`)).toBeUndefined();
    expect(await cacheManager.get(`/bucket/${bucket2}/data`)).toBeUndefined();
    expect(await cacheManager.get(`/bucket/${bucket3}/data`)).toEqual([{title: "test3"}]);
  });

  //@TODO: cron job does not fire the onTick method.
  xit("should clear cache at the end of day", async () => {
    await cacheManager.set(`/bucket/bucket1/data`, [{title: "test1"}]);
    await cacheManager.set(`/bucket/bucket2/data`, [{title: "test2"}]);

    jest.useFakeTimers();
    jest.setSystemTime(new Date(2020, 1, 1, 23, 59, 59, 0));

    jest.advanceTimersByTime(1000);

    expect(await cacheManager.get(`/bucket/bucket1/data`)).toBeUndefined();
    expect(await cacheManager.get(`/bucket/bucket2/data`)).toBeUndefined();

    jest.useRealTimers();
  });
});
