import {ActivityService} from "..";
import {TestingModule, Test} from "@nestjs/testing";
import {DatabaseTestingModule} from "../../../../../../libs/database/testing";
import {ACTIVITY_OPTIONS} from "../../../../../../libs/interface/activity";

describe("Activity Service", () => {
  let module: TestingModule;
  let service: ActivityService;
  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.create()],
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

  it("should create ttl index", async () => {
    let indexes = await service._coll.listIndexes().toArray();
    expect(indexes.length).toEqual(2);

    let ttlIndex = indexes.find(index => index.name == "created_at_1");
    expect(ttlIndex.expireAfterSeconds).toEqual(5);
  });

  it("should update existing ttl index expireAfterSeconds value", async () => {
    await service.upsertTTLIndex(10);

    let indexes = await service._coll.listIndexes().toArray();
    expect(indexes.length).toEqual(2);

    let ttlIndex = indexes.find(index => index.name == "created_at_1");
    expect(ttlIndex.expireAfterSeconds).toEqual(10);
  });
});
