import {Test, TestingModule} from "@nestjs/testing";
import {provideRepository} from "@spica-server/data";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {HISTORY_REPOSITORY, HistoryRepository} from "@spica-server/interface-bucket-history";
import {uuid} from "./support.js";

describe("PostgreSQL history of documents with a numeric key", () => {
  let module: TestingModule;
  let histories: HistoryRepository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.postgres()],
      providers: [provideRepository(HISTORY_REPOSITORY)]
    }).compile();
    await module.init();
    histories = module.get(HISTORY_REPOSITORY);
  }, 120_000);

  afterAll(() => module.close());

  const bucketId = uuid(1) as any;

  it("should find the entries of a document by its key", async () => {
    await histories.createHistory(bucketId, 7 as any, {id: 7, title: "old"}, {id: 7, title: "new"});
    await histories.createHistory(bucketId, 8 as any, {id: 8, title: "a"}, {id: 8, title: "b"});

    expect(await histories.findSummaries(bucketId, 7 as any)).toHaveLength(1);
    expect(await histories.findSummaries(bucketId, "7" as any)).toHaveLength(1);
    expect(await histories.findSummaries(bucketId, 8 as any)).toHaveLength(1);
  });

  it("should delete the entries of one document only", async () => {
    await histories.createHistory(bucketId, 9 as any, {id: 9, title: "a"}, {id: 9, title: "b"});
    await histories.createHistory(bucketId, 10 as any, {id: 10, title: "a"}, {id: 10, title: "b"});

    await histories.deleteByDocument(9 as any);

    expect(await histories.findSummaries(bucketId, 9 as any)).toEqual([]);
    expect(await histories.findSummaries(bucketId, 10 as any)).toHaveLength(1);
  });
});
