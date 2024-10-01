import {WebhookLogService} from "@spica-server/function/webhook/src/log.service";
import {TestingModule, Test} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {WEBHOOK_OPTIONS} from "@spica-server/function/webhook/src/interface";

describe("Webhook Log Service", () => {
  let module: TestingModule;
  let logService: WebhookLogService;
  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.create()],
      providers: [
        WebhookLogService,
        {
          provide: WEBHOOK_OPTIONS,
          useValue: {
            expireAfterSeconds: 5
          }
        }
      ]
    }).compile();
    logService = module.get(WebhookLogService);
    await new Promise(resolve => setTimeout(() => resolve(), 2000));
  }, 10000);

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
