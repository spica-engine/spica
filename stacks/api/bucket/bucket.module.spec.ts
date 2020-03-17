import {Test} from "@nestjs/testing";
import {HookModule} from "@spica-server/bucket/hooks";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {BucketModule} from "./bucket.module";
import {HistoryModule} from "./history/history.module";

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
    await module.close();
  }, 10000);

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
    await module.close();
  }, 10000);
});
