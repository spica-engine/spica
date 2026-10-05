import {WebhookLogService} from "@spica-server/function-webhook/src/log.service";
import {TestingModule, Test} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {WEBHOOK_OPTIONS} from "@spica-server/interface-function-webhook";
import {getIndexManager} from "@spica-server/database";

describe("Webhook Log Service", () => {
  let module: TestingModule;
  let logService: WebhookLogService;
  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.standalone()],
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
    await new Promise(resolve => setTimeout(() => resolve(""), 2000));
  });

  afterEach(async () => {
    return await module.close();
  });

  /**
   * The retention period is verified **independently of the mechanism**: a TTL index on MongoDB, a sweeper
   * registration on PostgreSQL (`nativeTTLIndex: false`). `ttlSeconds()` is the contract's
   * neutral read.
   */
  it("should set the log retention period", async () => {
    const retention = await getIndexManager(logService.db, logService.name).ttlSeconds();
    expect(retention).toEqual(5);
  });

  it("should update the log retention period", async () => {
    await logService.upsertTTLIndex(10);

    const retention = await getIndexManager(logService.db, logService.name).ttlSeconds();
    expect(retention).toEqual(10);
  });
});
