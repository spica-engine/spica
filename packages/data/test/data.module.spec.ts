import {Inject, Injectable, Module} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {DATA_ENGINE, DataAdapter, DataModule, ids} from "@spica-server/data";
import {ID_TYPES, IdTypes} from "@spica-server/interface-data";

const fakeIdTypes = {} as IdTypes;

@Module({})
class FakeAdapterModule {}

function fakeAdapter(providers = [{provide: ID_TYPES, useValue: fakeIdTypes}]): DataAdapter {
  return {
    engine: "fake",
    module: {
      module: FakeAdapterModule,
      providers,
      exports: providers.map(p => p.provide)
    }
  };
}

@Injectable()
class Consumer {
  constructor(@Inject(ID_TYPES) readonly idTypes: IdTypes) {}
}

describe("DataModule", () => {
  it("should expose the adapter's engine name", async () => {
    const module = await Test.createTestingModule({
      imports: [DataModule.forRoot(fakeAdapter())]
    }).compile();

    expect(module.get(DATA_ENGINE)).toBe("fake");
  });

  it("should expose the adapter's id types to modules that don't import it", async () => {
    @Module({providers: [Consumer]})
    class FeatureModule {}

    const module = await Test.createTestingModule({
      imports: [DataModule.forRoot(fakeAdapter()), FeatureModule]
    }).compile();

    expect(module.get(Consumer).idTypes).toBe(fakeIdTypes);
  });

  it("should bind the adapter's id types for static access", async () => {
    await Test.createTestingModule({
      imports: [DataModule.forRoot(fakeAdapter())]
    }).compile();

    expect(ids()).toBe(fakeIdTypes);
  });

  it("should fail when the adapter provides no id types", async () => {
    await expect(
      Test.createTestingModule({
        imports: [DataModule.forRoot(fakeAdapter([]))]
      }).compile()
    ).rejects.toThrow();
  });
});
