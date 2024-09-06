import {Test} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {HistoryModule} from "@spica-server/bucket/history";
import {HookModule} from "@spica-server/bucket/hooks";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {BucketCacheModule} from "@spica-server/bucket/cache";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;

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
          cache: false,
          graphql: false
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
          cache: false,
          graphql: false
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
          cache: false,
          graphql: false
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
          graphql: false,
          cache: false
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

  it("should import cache module", async () => {
    const module = await Test.createTestingModule({
      imports: [
        PassportTestingModule.initialize(),
        DatabaseTestingModule.replicaSet(),
        PreferenceTestingModule,
        BucketModule.forRoot({
          hooks: false,
          realtime: false,
          history: false,
          cache: true,
          graphql: false
        })
      ]
    }).compile();

    expect(module.get(BucketCacheModule)).toBeTruthy();
    await module.close();
  });

  it("should not import cache module", async () => {
    const module = await Test.createTestingModule({
      imports: [
        PassportTestingModule.initialize(),
        DatabaseTestingModule.replicaSet(),
        PreferenceTestingModule,
        BucketModule.forRoot({
          hooks: false,
          realtime: false,
          history: false,
          cache: false,
          graphql: false
        })
      ]
    }).compile();

    expect(() => {
      module.get(BucketCacheModule);
    }).toThrow(
      new Error(
        "Nest could not find BucketCacheModule element (this provider does not exist in the current context)"
      )
    );
  });
});
