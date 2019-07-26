import {Test} from "@nestjs/testing";
import {DatabaseService, DatabaseTestingModule} from "@spica-server/database/testing";
import {Bucket} from "./bucket";
import {BucketCache} from "./cache";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;

describe("bucket cache", () => {
  let cache: BucketCache;
  let database: DatabaseService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()],
      providers: [BucketCache]
    }).compile();
    cache = module.get(BucketCache);
    database = module.get(DatabaseService);
  });

  afterEach(() => {
    cache.clear();
  });

  it("should invalidate when schema changes", async () => {
    let schema: Bucket = {
      primary: ""
    };
    const buckets = database.collection("buckets");
    await buckets.insertOne(schema);
    cache.put(schema._id.toHexString(), schema);
    await buckets.updateOne({_id: schema._id}, {$set: schema});
    // Wait some till cache invalidated
    await new Promise(resolve => setTimeout(resolve, 1000));
    expect(cache.get(schema._id.toHexString())).toBe(undefined);
  });
});
