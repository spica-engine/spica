import {Test} from "@nestjs/testing";
import {HookModule} from "@spica-server/bucket/hooks";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {BucketModule} from "./bucket.module";
import {HistoryModule} from "./history";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 12000;

describe("bucket module", () => {
  it("should import hook module", async () => {
    let module = await Test.createTestingModule({
      imports: [
        PassportTestingModule.initialize(),
        DatabaseTestingModule.replicaSet(),
        BucketModule.forRoot({hooks: true, realtime: false, history: false})
      ]
    }).compile();

    expect(module.get(HookModule)).toBeTruthy();
    await module.close();
  });

  it("shouldn't import hook module", async () => {
    let module = await Test.createTestingModule({
      imports: [
        PassportTestingModule.initialize(),
        DatabaseTestingModule.replicaSet(),
        BucketModule.forRoot({hooks: false, history: false, realtime: false})
      ]
    }).compile();

    expect(() => {
      module.get(HookModule);
    }).toThrow(new Error("Nest cannot find given element (it does not exist in current context)"));
  });

  it("should import history module", async () => {
    let module = await Test.createTestingModule({
      imports: [
        PassportTestingModule.initialize(),
        DatabaseTestingModule.replicaSet(),
        BucketModule.forRoot({hooks: false, realtime: false, history: true})
      ]
    }).compile();

    expect(module.get(HistoryModule)).toBeTruthy();
    await module.close();
  });

  it("shouldn't import history module", async () => {
    let module = await Test.createTestingModule({
      imports: [
        PassportTestingModule.initialize(),
        DatabaseTestingModule.replicaSet(),
        BucketModule.forRoot({hooks: false, realtime: false, history: false})
      ]
    }).compile();

    expect(() => {
      module.get(HistoryModule);
    }).toThrow(new Error("Nest cannot find given element (it does not exist in current context)"));
  });
});
