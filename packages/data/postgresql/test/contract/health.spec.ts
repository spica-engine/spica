import {Test, TestingModule} from "@nestjs/testing";
import {DATA_ENGINE} from "@spica-server/data";
import {contractSuite} from "@spica-server/database-testing";
import {DATA_HEALTH, DataHealth} from "@spica-server/interface-data";

contractSuite("data health", engine => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({imports: [engine.module()]}).compile();
    await module.init();
  });

  afterAll(() => module.close());

  it("reports the engine it is bound to", () => {
    expect(module.get(DATA_ENGINE)).toBe(engine.name);
  });

  it("pings the database", async () => {
    await expect(module.get<DataHealth>(DATA_HEALTH).ping()).resolves.toBeUndefined();
  });
});
