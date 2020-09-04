import {Test, TestingModule} from "@nestjs/testing";
import {BucketDataService, BucketModule} from "@spica-server/bucket";
import {DocumentScheduler} from "@spica-server/bucket/src/scheduler";
import {
  DatabaseTestingModule,
  ObjectId,
  DatabaseService,
  stream
} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

describe("Scheduler", () => {
  let bds: jasmine.SpyObj<BucketDataService>;
  let scheduler: DocumentScheduler;
  const bucketId = new ObjectId();
  const documentId = new ObjectId();
  let module: TestingModule;
  let clock: jasmine.Clock;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.replicaSet(),
        PassportTestingModule.initialize(),
        PreferenceTestingModule,
        BucketModule.forRoot({
          hooks: false,
          realtime: false,
          history: false
        })
      ]
    })
      .overrideProvider(BucketDataService)
      .useValue(jasmine.createSpyObj("Bucket Data Service", ["updateOne"]))
      .compile();
    bds = module.get(BucketDataService);
    scheduler = module.get(DocumentScheduler);
    clock = jasmine.clock();
  }, 600000);

  afterAll(async () => await module.close());

  beforeEach(() => {
    clock.install();
    bds.updateOne.calls.reset();
    clock.mockDate(new Date());
  });

  afterEach(() => {
    clock.uninstall();
  });

  it("should publish immediately if the date is past", () => {
    const date = new Date();
    date.setSeconds(date.getSeconds() + 1);

    scheduler.schedule(bucketId, documentId, date);

    clock.tick(1500);

    expect(bds.updateOne).toHaveBeenCalledTimes(1);
    const [scheduledBucketId, filter, update] = bds.updateOne.calls.mostRecent().args;
    expect(bds.updateOne).toHaveBeenCalledTimes(1);
    expect(scheduledBucketId).toBe(bucketId);
    expect(filter).toEqual({_id: documentId});
    expect(update).toEqual({$unset: {_schedule: ""}});
  });

  it("should publish after 15seconds", () => {
    const date = new Date();

    date.setSeconds(date.getSeconds() + 15);

    scheduler.schedule(bucketId, documentId, date);
    expect(bds.updateOne).not.toHaveBeenCalled();

    clock.tick(15000);

    expect(bds.updateOne).toHaveBeenCalledTimes(1);
    const [scheduledBucketId, filter, update] = bds.updateOne.calls.mostRecent().args;
    expect(bds.updateOne).toHaveBeenCalledTimes(1);
    expect(scheduledBucketId).toBe(bucketId);
    expect(filter).toEqual({_id: documentId});
    expect(update).toEqual({$unset: {_schedule: ""}});
  });

  it("should call schedule when entry inserted", async () => {
    let scheduleSpy = spyOn(scheduler, "schedule");

    const date = new Date();

    date.setSeconds(date.getSeconds() + 15);

    await module
      .get(DatabaseService)
      .collection(`bucket_${bucketId}`)
      .insertOne({
        _id: documentId,
        _schedule: date
      });

    await stream.change.wait();

    expect(scheduleSpy).toHaveBeenCalledTimes(1);
    expect(scheduleSpy).toHaveBeenCalledWith(bucketId, documentId, date);
  });
});
