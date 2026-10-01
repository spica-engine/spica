import {LogService} from "@spica-server/function-log/src/log.service";
import {TestingModule, Test} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {FUNCTION_LOG_OPTIONS} from "@spica-server/interface-function-log";
import {getIndexManager} from "@spica-server/database";

describe("Function Log Service", () => {
  let module: TestingModule;
  let logService: LogService;
  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.standalone()],
      providers: [
        LogService,
        {
          provide: FUNCTION_LOG_OPTIONS,
          useValue: {
            expireAfterSeconds: 5
          }
        }
      ]
    }).compile();
    logService = module.get(LogService);
    await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));
  });

  afterEach(async () => {
    return await module.close();
  });

  /**
   * The retention period is verified **independently of the mechanism**.
   *
   * It used to look for an index named `created_at_1` and count `indexes.length`. Both are MongoDB
   * specific: on PostgreSQL retention is not a TTL index but a sweeper registration
   * (`nativeTTLIndex: false` declares that, R30) and such an index **not existing** is correct.
   * `ttlSeconds()` is the contract's neutral read; both backends give the same answer.
   */
  it("should set the log retention period", async () => {
    const retention = await getIndexManager(logService.db, logService.name).ttlSeconds();
    expect(retention).toEqual(5);
  });

  it("should create an index that serves per-function listing sorted by _id", async () => {
    const indexes = await getIndexManager(logService.db, logService.name).list();

    const listingIndex = indexes.find(index => index.name == "function_1__id_-1");
    // `IIndexManager.list()` gives the contract's shape: `keys` is an **ordered** array, not an object.
    // The field order is meaningful in a compound index and object key order cannot be relied on (R3).
    expect(listingIndex.keys).toEqual([
      {field: "function", direction: 1},
      {field: "_id", direction: -1}
    ]);
  });

  it("should update the log retention period", async () => {
    await logService.upsertTTLIndex(10);

    const retention = await getIndexManager(logService.db, logService.name).ttlSeconds();
    expect(retention).toEqual(10);
  });
});
