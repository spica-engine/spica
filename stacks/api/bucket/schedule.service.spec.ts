import {Test} from "@nestjs/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {BucketDataService} from "./bucket-data.service";
import {DocumentScheduler} from "./schedule.service";
import {BucketModule} from "./bucket.module";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 12000;

describe("bucket schedule service", () => {
  let bds: BucketDataService;
  let scheduler: DocumentScheduler;
  const bucketId = new ObjectId();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet(), BucketModule]
    })
      .overrideProvider(BucketDataService)
      .useValue(jasmine.createSpyObj("Bucket Data Service", ["replaceOne"]))
      .compile();
    bds = module.get(BucketDataService);
    scheduler = module.get(DocumentScheduler);
  });

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
});
