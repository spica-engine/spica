import {ActivityService} from "@spica-server/activity-services";
import {TestingModule, Test} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {ACTIVITY_OPTIONS} from "@spica-server/interface-activity";
import {getIndexManager} from "@spica-server/database";

describe("Activity Service", () => {
  let module: TestingModule;
  let service: ActivityService;
  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.standalone()],
      providers: [
        ActivityService,
        {
          provide: ACTIVITY_OPTIONS,
          useValue: {
            expireAfterSeconds: 5
          }
        }
      ]
    }).compile();
    service = module.get(ActivityService);
    await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));
  });

  afterEach(async () => {
    return await module.close();
  });

  /**
   * The retention period is verified **independently of the mechanism**, the same way as in
   * `api/function/log`.
   *
   * It used to look for an index named `created_at_1` and count `indexes.length`. Both are MongoDB
   * specific: on PostgreSQL retention is a sweeper registration rather than a TTL index
   * (`nativeTTLIndex: false` declares that, R30) and such an index **not existing** is correct.
   * `ttlSeconds()` is the contract's neutral read; both backends give the same answer.
   */
  it("should set the activity retention period", async () => {
    const retention = await getIndexManager(service.db, service.name).ttlSeconds();
    expect(retention).toEqual(5);
  });

  it("should update the activity retention period", async () => {
    await service.upsertTTLIndex(10);

    const retention = await getIndexManager(service.db, service.name).ttlSeconds();
    expect(retention).toEqual(10);
  });
});
