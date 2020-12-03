import {Test, TestingModule} from "@nestjs/testing";
import {BucketDataService} from "@spica-server/bucket";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";

describe("Bucket Data Service", () => {
  let module: TestingModule;
  let bds: BucketDataService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.create()],
      providers: [BucketDataService]
    }).compile();

    bds = module.get(BucketDataService);
  });

  afterEach(() => module.close());

  it("should create children correctly", () => {
    const id = new ObjectId();
    const result = bds.children(id);
    expect(result._collection).toEqual("bucket_" + id);
  });
});
