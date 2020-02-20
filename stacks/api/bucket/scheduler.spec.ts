import {Test, TestingModule} from "@nestjs/testing";
import {BucketDataService, BucketModule} from "@spica-server/bucket";
import {DocumentScheduler} from "@spica-server/bucket/scheduler";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;

describe("scheduler", () => {
  let bds: BucketDataService;
  let scheduler: DocumentScheduler;
  const bucketId = new ObjectId();
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.replicaSet(),
        BucketModule.forRoot({hooks: !!process.env.ENABLE_BUCKET_HOOKS})
      ]
    })
      .overrideProvider(BucketDataService)
      .useValue(jasmine.createSpyObj("Bucket Data Service", ["replaceOne"]))
      .compile();
    bds = module.get(BucketDataService);
    scheduler = module.get(DocumentScheduler);
  }, 120000);

  it("should publish immediately if the date is past", done => {
    const documentId = new ObjectId();
    const date = new Date();
    date.setSeconds(date.getSeconds() + 1);

    scheduler.schedule(bucketId, documentId, date, {_id: documentId, test: 123});
    const replaceOne = bds.replaceOne as jasmine.Spy;
    setTimeout(() => {
      const [scheduledBucketId, scheduledDocument] = replaceOne.calls.mostRecent().args;
      expect(replaceOne).toHaveBeenCalledTimes(1);
      expect(scheduledBucketId).toBe(bucketId);
      expect(scheduledDocument).not.toBeFalsy();
      expect(scheduledDocument._id).toBe(documentId);
      expect(scheduledDocument.test).toBe(123);
      done();
    }, 1000);
  });

  afterAll(async () => {
    await module.close();
  });
});
