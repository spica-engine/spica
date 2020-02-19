import {TestingModule, Test} from "@nestjs/testing";
import {BucketModule} from "./bucket.module";
import {HookModule} from "@spica-server/bucket/hooks";
import {HistoryModule} from "./history/history.module";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";

describe("bucket module", () => {
  it("imports hook module", async () => {
    let module = await Test.createTestingModule({
      imports: [
        PassportTestingModule.initialize(),
        DatabaseTestingModule.replicaSet(),
        HistoryModule,
        BucketModule.forRoot({hooks: true})
      ]
    }).compile();

    expect(module.get(HookModule)).toBeTruthy();
  });

  //NOTE: 10000 secs timeout to give enough time for db setuo
  it("does not import hook module", async () => {
    let module = await Test.createTestingModule({
      imports: [
        PassportTestingModule.initialize(),
        DatabaseTestingModule.replicaSet(),
        HistoryModule,
        BucketModule.forRoot({hooks: false})
      ]
    }).compile();

    expect(() => {
      module.get(HookModule);
    }).toThrow(new Error("Nest cannot find given element (it does not exist in current context)"));
  }, 10000);

  //  afterEach(async () => {
  //    await module.close();
  //  });
});
