import {LogService} from "@spica-server/function/log/src/log.service";
import {TestingModule, Test} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {FUNCTION_LOG_OPTIONS} from "@spica-server/interface/function/log";

describe("Function Log Service", () => {
  let module: TestingModule;
  let logService: LogService;
  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.create()],
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

  it("should create ttl index", async () => {
    let indexes = await logService._coll.listIndexes().toArray();
    expect(indexes.length).toEqual(2);

    let ttlIndex = indexes.find(index => index.name == "created_at_1");
    expect(ttlIndex.expireAfterSeconds).toEqual(5);
  });

  it("should update existing ttl index expireAfterSeconds value", async () => {
    await logService.upsertTTLIndex(10);

    let indexes = await logService._coll.listIndexes().toArray();
    expect(indexes.length).toEqual(2);

    let ttlIndex = indexes.find(index => index.name == "created_at_1");
    expect(ttlIndex.expireAfterSeconds).toEqual(10);
  });
});
