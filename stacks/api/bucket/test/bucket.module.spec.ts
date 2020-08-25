import {Test} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {HistoryModule} from "@spica-server/bucket/history";
import {HookModule} from "@spica-server/bucket/hooks";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {DataChangeModule} from "@spica-server/bucket/change";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 12000;

describe("Bucket Module", () => {
  it("should import hook module", async () => {
    const module = await Test.createTestingModule({
      imports: [
        PassportTestingModule.initialize(),
        DatabaseTestingModule.replicaSet(),
        PreferenceTestingModule,
        BucketModule.forRoot({
          hooks: true,
          realtime: false,
          history: false,
          experimentalDataChange: false
        })
      ]
    }).compile();

    expect(module.get(HookModule)).toBeTruthy();
    await module.close();
  });

  it("should not import hook module", async () => {
    const module = await Test.createTestingModule({
      imports: [
        PassportTestingModule.initialize(),
        DatabaseTestingModule.replicaSet(),
        PreferenceTestingModule,
        BucketModule.forRoot({
          hooks: false,
          realtime: false,
          history: false,
          experimentalDataChange: false
        })
      ]
    }).compile();

    expect(() => {
      module.get(HookModule);
    }).toThrow(
      new Error(
        "Nest could not find HookModule element (this provider does not exist in the current context)"
      )
    );
  });

  it("should import history module", async () => {
    const module = await Test.createTestingModule({
      imports: [
        PassportTestingModule.initialize(),
        DatabaseTestingModule.replicaSet(),
        PreferenceTestingModule,
        BucketModule.forRoot({
          hooks: false,
          realtime: false,
          history: true,
          experimentalDataChange: false
        })
      ]
    }).compile();

    expect(module.get(HistoryModule)).toBeTruthy();
    await module.close();
  });

  it("should not import history module", async () => {
    const module = await Test.createTestingModule({
      imports: [
        PassportTestingModule.initialize(),
        DatabaseTestingModule.replicaSet(),
        PreferenceTestingModule,
        BucketModule.forRoot({
          hooks: false,
          realtime: false,
          history: false,
          experimentalDataChange: false
        })
      ]
    }).compile();

    expect(() => {
      module.get(HistoryModule);
    }).toThrow(
      new Error(
        "Nest could not find HistoryModule element (this provider does not exist in the current context)"
      )
    );
  });

  it("should import data change module", async () => {
    const module = await Test.createTestingModule({
      imports: [
        PassportTestingModule.initialize(),
        DatabaseTestingModule.replicaSet(),
        PreferenceTestingModule,
        BucketModule.forRoot({
          hooks: false,
          realtime: false,
          history: false,
          experimentalDataChange: true
        })
      ]
    }).compile();

    expect(module.get(DataChangeModule)).toBeTruthy();
    await module.close();
  });

  it("should not import data change module", async () => {
    const module = await Test.createTestingModule({
      imports: [
        PassportTestingModule.initialize(),
        DatabaseTestingModule.replicaSet(),
        PreferenceTestingModule,
        BucketModule.forRoot({
          hooks: false,
          realtime: false,
          history: false,
          experimentalDataChange: false
        })
      ]
    }).compile();

    expect(() => {
      module.get(DataChangeModule);
    }).toThrow(
      new Error(
        "Nest could not find DataChangeModule element (this provider does not exist in the current context)"
      )
    );
  });
});
