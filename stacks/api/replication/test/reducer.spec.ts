import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {JobReducer, JobService, REPLICATION_SERVICE_OPTIONS} from "@spica-server/replication";
import {replicationServiceOptions} from "@spica-server/replication/testing";

describe("Commander", () => {
  let module: TestingModule;
  let reducer: JobReducer;
  let meta;
  let job = jasmine.createSpy();

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()],
      providers: [
        {provide: REPLICATION_SERVICE_OPTIONS, useValue: replicationServiceOptions},
        JobService,
        JobReducer
      ]
    }).compile();

    reducer = module.get(JobReducer);

    job.calls.reset();
    meta = {_id: "1", user: "user66", age: 2, type: "insert"};
  });

  it("should reduce jobs if they are identical", async () => {
    await Promise.all([reducer.do(meta, job), reducer.do(meta, job)]);

    expect(job).toHaveBeenCalledTimes(1);
  });

  it("should not reduce jobs if they are not identical", async () => {
    await reducer.do(meta, job);
    await reducer.do({...meta, _id: "2"}, job);

    expect(job).toHaveBeenCalledTimes(2);
  });
});
