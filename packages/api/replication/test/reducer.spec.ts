import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {JobReducer} from "@spica-server/replication";
import {provideRepository} from "@spica-server/data";
import {JOB_REPOSITORY, REPLICATION_SERVICE_OPTIONS} from "@spica-server/interface-replication";
import {replicationServiceOptions} from "@spica-server/replication/testing";

describe("Commander", () => {
  let module: TestingModule;
  let reducer: JobReducer;
  let meta;
  let job = jest.fn();

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.standalone()],
      providers: [
        {provide: REPLICATION_SERVICE_OPTIONS, useValue: replicationServiceOptions},
        provideRepository(JOB_REPOSITORY),
        JobReducer
      ]
    }).compile();

    reducer = module.get(JobReducer);

    job.mockReset();
    meta = {_id: "1", user: "user66", age: 2, type: "insert"};
  });

  it("should reduce jobs if they are identical", async () => {
    await Promise.all([reducer.do(meta, job), reducer.do(meta, job)]);

    expect(job).toHaveBeenCalledTimes(1);
  });

  it("should not reduce jobs if they are not identical", async () => {
    await Promise.all([reducer.do(meta, job), reducer.do({...meta, _id: "2"}, job)]);

    expect(job).toHaveBeenCalledTimes(2);
  });

  it("should set created_at on the stored job so the TTL index can expire it", async () => {
    await reducer.do(meta, job);

    const stored = await module.get(JOB_REPOSITORY).findOne({_id: meta._id});
    expect(stored.created_at).toBeInstanceOf(Date);
  });
});
