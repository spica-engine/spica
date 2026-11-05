import {Test, TestingModule} from "@nestjs/testing";
import {InvalidIdError, provideRepository} from "@spica-server/data";
import {contractSuite} from "@spica-server/database-testing";
import {
  COLLECTION_QUERY,
  CollectionQueryFacade,
  ID_TYPES,
  IdTypes,
  ResourceFilterSpec
} from "@spica-server/interface-data";
import {ENV_VAR_REPOSITORY, EnvVarRepository} from "@spica-server/interface-env_var";
import {clearStorage, waitForMongoIndexes} from "./support.js";

const sorted = (...ids: string[]) => ids.sort();

contractSuite("resource filter", engine => {
  let module: TestingModule;
  let queries: CollectionQueryFacade;
  let envVars: EnvVarRepository;
  let ids: IdTypes;
  let [a, b, c, d]: string[] = [];

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module()],
      providers: [provideRepository(ENV_VAR_REPOSITORY)]
    }).compile();
    await module.init();
    await waitForMongoIndexes(engine, module, {env_var: ["key_1"]});

    queries = module.get(COLLECTION_QUERY);
    envVars = module.get(ENV_VAR_REPOSITORY);
    ids = module.get(ID_TYPES);
  }, 120_000);

  afterAll(() => module.close());

  beforeEach(async () => {
    await clearStorage(engine, module, {mongodb: ["env_var"], postgresql: ["env_vars"]});
    const inserted: string[] = [];
    for (const key of ["a", "b", "c", "d"]) {
      inserted.push(String((await envVars.insert({key, value: key}))._id));
    }
    [a, b, c, d] = inserted;
  });

  const store = {
    newId: () => ids.forCollection("env_var").serialize(ids.forCollection("env_var").generate()),
    async allowed(resourceFilter: ResourceFilterSpec | undefined) {
      const found = await queries.find<{_id: unknown}>("env_var", {resourceFilter});
      return found.map(document => String(document._id)).sort();
    }
  };

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
