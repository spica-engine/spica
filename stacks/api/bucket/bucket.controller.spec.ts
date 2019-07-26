import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {BucketController} from "./bucket.controller";
import {BucketService} from "./bucket.service";

// TODO(thesayyn): complete this test
describe("bucket controller", () => {
  let module: TestingModule;
  // let controller: BucketController;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.create()],
      providers: [BucketService],
      controllers: [BucketController]
    }).compile();
  });

  afterAll(async () => {
    return await module.close();
  });
});
