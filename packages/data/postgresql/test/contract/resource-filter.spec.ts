import {Test, TestingModule} from "@nestjs/testing";
import {InvalidIdError} from "@spica-server/data";
import {contractSuite} from "@spica-server/database-testing";
import {createResourceStore, ResourceStore} from "./resource-store";

const sorted = (...ids: string[]) => ids.sort();

contractSuite("resource filter", engine => {
  let module: TestingModule;
  let store: ResourceStore;
  let [a, b, c, d]: string[] = [];

  beforeAll(async () => {
    module = await Test.createTestingModule({imports: [engine.module()]}).compile();
    await module.init();
    store = await createResourceStore(engine, module);
  });

  afterAll(() => module.close());

  beforeEach(async () => {
    [a, b, c, d] = await store.reset(4);
  });

  it("should let everything through when there is no filter", async () => {
    expect(await store.allowed(undefined)).toEqual(sorted(a, b, c, d));
  });

  it("should let only the included ids through", async () => {
    expect(await store.allowed({include: [a, b], exclude: []})).toEqual(sorted(a, b));
  });

  it("should hold back the excluded ids", async () => {
    expect(await store.allowed({include: [], exclude: [[a]]})).toEqual(sorted(b, c, d));
  });

  it("should treat the exclude lists of different statements as alternatives", async () => {
    const filter = {include: [], exclude: [[a], [b]]};

    expect(await store.allowed(filter)).toEqual(sorted(a, b, c, d));
  });

  it("should add the included ids to what the exclude lists let through", async () => {
    const filter = {include: [c], exclude: [[a, b]]};

    expect(await store.allowed(filter)).toEqual(sorted(c, d));
  });

  describe("edge cases", () => {
    it("should let everything through when include and exclude are empty", async () => {
      expect(await store.allowed({include: [], exclude: []})).toEqual(sorted(a, b, c, d));
    });

    it("should let everything through when the only exclude list is empty", async () => {
      expect(await store.allowed({include: [], exclude: [[]]})).toEqual(sorted(a, b, c, d));
    });

    it("should let nothing through for an id that does not exist", async () => {
      expect(await store.allowed({include: [store.newId()], exclude: []})).toEqual([]);
    });

    it("should let nothing through when an exclude list names every id", async () => {
      expect(await store.allowed({include: [], exclude: [[a, b, c, d]]})).toEqual([]);
    });

    it("should cope with an id that is listed twice", async () => {
      expect(await store.allowed({include: [a, a], exclude: [[b, b]]})).toEqual(sorted(a, c, d));
    });
  });

  it("should reject an id that is not valid", async () => {
    await expect(store.allowed({include: ["not-an-id"], exclude: []})).rejects.toThrow(
      InvalidIdError
    );
  });
});
