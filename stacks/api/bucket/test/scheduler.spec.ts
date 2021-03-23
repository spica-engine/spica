import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {BucketDataService} from "@spica-server/bucket/services";
import {DocumentScheduler} from "@spica-server/bucket/src/scheduler";
import {
  DatabaseService,
  DatabaseTestingModule,
  ObjectId,
  stream
} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

describe("Scheduler", () => {
  const bucketId = new ObjectId();
  const documentId = new ObjectId();
  let module: TestingModule;
  let clock: jasmine.Clock;

  let scheduler: DocumentScheduler;
  let children: jasmine.SpyObj<ReturnType<typeof BucketDataService.prototype.children>>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.replicaSet(),
        PassportTestingModule.initialize(),
        PreferenceTestingModule,
        BucketModule.forRoot({
          hooks: false,
          realtime: false,
          history: false,
          cache: false
        })
      ]
    })
      .overrideProvider(BucketDataService)
      .useValue({children: () => children})
      .compile();

    scheduler = module.get(DocumentScheduler);
    clock = jasmine.clock();
  });

  afterAll(async () => await module.close());

  beforeEach(() => {
    clock.install();
    children = jasmine.createSpyObj("coll", ["updateOne"]);
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

    const [filter, update] = children.updateOne.calls.mostRecent().args;
    expect(children.updateOne).toHaveBeenCalledTimes(1);
    expect(filter).toEqual({_id: documentId});
    expect(update).toEqual({$unset: {_schedule: ""}});
  });

  it("should publish after 15seconds", () => {
    const date = new Date();

    date.setSeconds(date.getSeconds() + 15);

    scheduler.schedule(bucketId, documentId, date);
    expect(children.updateOne).not.toHaveBeenCalled();

    clock.tick(15000);

    const [filter, update] = children.updateOne.calls.mostRecent().args;
    expect(children.updateOne).toHaveBeenCalledTimes(1);
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
