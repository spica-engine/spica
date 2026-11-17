import {Test} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {BucketOptions} from "@spica-server/interface-bucket";
import {HistoryModule} from "@spica-server/bucket-history";
import {HookModule} from "@spica-server/bucket-hooks";
import {contractSuite} from "@spica-server/database-testing";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {PreferenceTestingModule} from "@spica-server/preference-testing";
import {BucketCacheModule} from "@spica-server/bucket-cache";

contractSuite("Bucket Module", engine => {
  const compile = (flags: Partial<BucketOptions>) =>
    Test.createTestingModule({
      imports: [
        PassportTestingModule.initialize(),
        engine.module(),
        PreferenceTestingModule,
        BucketModule.forRoot({
          hooks: false,
          realtime: false,
          history: false,
          cache: false,
          graphql: false,
          ...flags
        })
      ]
    }).compile();

  const notFound = (name: string) =>
    new Error(
      `Nest could not find ${name} element (this provider does not exist in the current context)`
    );

  it("should import hook module", async () => {
    const module = await compile({hooks: true});

    expect(module.get(HookModule)).toBeTruthy();
    await module.close();
  });

  it("should not import hook module", async () => {
    const module = await compile({});

    expect(() => module.get(HookModule)).toThrow(notFound("HookModule"));
    await module.close();
  });

  it("should import history module", async () => {
    const module = await compile({history: true});

    expect(module.get(HistoryModule)).toBeTruthy();
    await module.close();
  });

  it("should not import history module", async () => {
    const module = await compile({});

    expect(() => module.get(HistoryModule)).toThrow(notFound("HistoryModule"));
    await module.close();
  });

  it("should import cache module", async () => {
    const module = await compile({cache: true});

    expect(module.get(BucketCacheModule)).toBeTruthy();
    await module.close();
  });

  it("should not import cache module", async () => {
    const module = await compile({});

    expect(() => module.get(BucketCacheModule)).toThrow(notFound("BucketCacheModule"));
    await module.close();
  });
});
