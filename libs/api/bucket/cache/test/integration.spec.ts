import {Controller, Get, INestApplication, Post, UseInterceptors} from "@nestjs/common";
import {
  BucketCacheModule,
  BucketCacheService,
  invalidateCache,
  registerCache
} from "@spica-server/bucket/cache";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {Test} from "@nestjs/testing";
import {Store} from "cache-manager";
import {DatabaseTestingModule} from "@spica-server/database/testing";

@Controller("bucket/:bucketId/data")
export class TestController {
  getSpy = jest.fn();

  @UseInterceptors(registerCache())
  @Get()
  get() {
    this.getSpy();
    return [{title: "title1"}];
  }

  @UseInterceptors(invalidateCache())
  @Post()
  insert() {
    return {title: "new_title"};
  }
}

async function waitForCacheInvalidation() {
  await new Promise((resolve, _) => setTimeout(resolve, 100));
}

describe("Bucket Cache Integration", () => {
  describe("with cache module", () => {
    let req: Request;
    let app: INestApplication;
    let service: BucketCacheService;
    let getSpy: jest.Mock;
    let store: Store;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        imports: [
          DatabaseTestingModule.standalone(),
          CoreTestingModule,
          BucketCacheModule.register({ttl: 60})
        ],
        controllers: [TestController],
        providers: []
      }).compile();

      req = module.get(Request);

      app = module.createNestApplication();
      await app.listen(req.socket);

      service = module.get(BucketCacheService);
      store = service["cacheManager"].store;

      getSpy = module.get(TestController).getSpy;
    });

    it("should use cached response", async () => {
      await req.get("bucket/bucket_id/data");
      await req.get("bucket/bucket_id/data");

      expect(getSpy).toHaveBeenCalledTimes(1);
    });

    it("should register cache", async () => {
      await req.get("bucket/bucket_id/data");

      const cachedKeys = await store.keys();
      expect(cachedKeys).toEqual(["/bucket/bucket_id/data&accept-language=undefined"]);

      const cachedResponse = await store.get(cachedKeys[0]);
      expect(cachedResponse).toEqual([{title: "title1"}]);
    });

    it("should register new cache for different requests", async () => {
      await req.get("bucket/bucket_id/data");
      await req.get("bucket/bucket_id/data", {limit: 5});
      await req.get("bucket/bucket_id/data", {}, {"accept-language": "en-US"});

      expect(getSpy).toHaveBeenCalledTimes(3);

      const cachedKeys = await store.keys();

      expect(cachedKeys).toEqual([
        "/bucket/bucket_id/data&accept-language=en-US",
        "/bucket/bucket_id/data?limit=5&accept-language=undefined",
        "/bucket/bucket_id/data&accept-language=undefined"
      ]);

      const cachedResponses = await Promise.all([
        store.get(cachedKeys[0]),
        store.get(cachedKeys[1]),
        store.get(cachedKeys[2])
      ]);

      expect(cachedResponses).toEqual([
        [{title: "title1"}],
        [{title: "title1"}],
        [{title: "title1"}]
      ]);
    });

    it("should invalidate cache, then register again", async () => {
      await req.get("bucket/bucket_id/data");
      await req.post("bucket/bucket_id/data");

      await waitForCacheInvalidation();

      let cachedKeys = await store.keys();

      expect(cachedKeys).toEqual([]);

      await req.get("bucket/bucket_id/data");

      cachedKeys = await store.keys();
      expect(cachedKeys).toEqual(["/bucket/bucket_id/data&accept-language=undefined"]);

      const cachedResponse = await store.get(cachedKeys[0]);
      expect(cachedResponse).toEqual([{title: "title1"}]);
    });

    it("should invalidate cache after ttl expired", async () => {
      await req.get("bucket/bucket_id/data");
      expect(getSpy).toHaveBeenCalledTimes(1);

      let cachedKeys = await store.keys();
      expect(cachedKeys.length).toEqual(1);

      await new Promise(r => setTimeout(r, 1000));

      // it will clear cache right after same request received
      await req.get("bucket/bucket_id/data");
      // if it calls this spy one more time we can consider old cache cleared and new cache will be registered
      expect(getSpy).toHaveBeenCalledTimes(2);

      cachedKeys = await store.keys();
      expect(cachedKeys.length).toEqual(1);
    });
  });

  describe("without cache module", () => {
    let req: Request;
    let app: INestApplication;
    let getSpy: jest.Mock;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        imports: [CoreTestingModule],
        controllers: [TestController],
        providers: []
      }).compile();

      req = module.get(Request);

      app = module.createNestApplication();
      await app.listen(req.socket);

      getSpy = module.get(TestController).getSpy;
    });

    it("should not interrupt the flow", async () => {
      let response = await req.get("bucket/bucket_id/data");
      expect(response.body).toEqual([{title: "title1"}]);
      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);

      response = await req.get("bucket/bucket_id/data");
      expect(response.body).toEqual([{title: "title1"}]);
      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);

      expect(getSpy).toHaveBeenCalledTimes(2);

      response = await req.post("bucket/bucket_id/data");
      expect(response.body).toEqual({title: "new_title"});
      expect([response.statusCode, response.statusText]).toEqual([201, "Created"]);
    });
  });
});
