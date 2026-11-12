import {Test, TestingModule} from "@nestjs/testing";
import {contractSuite} from "@spica-server/database-testing";
import {BUCKET_DATA_REPOSITORY, BucketDataRepository} from "@spica-server/interface-bucket";
import {idOf} from "@spica-server/data";
import {ID_TYPES, IdTypes} from "@spica-server/interface-data";
import {BucketStore, bucketStoreProviders, createBucketStore} from "./bucket-store.js";

contractSuite("bucket data repository", engine => {
  let module: TestingModule;
  let store: BucketStore;
  let repository: BucketDataRepository;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module()],
      providers: bucketStoreProviders(engine)
    }).compile();
    await module.init();
    store = createBucketStore(engine, module);
    repository = module.get(BUCKET_DATA_REPOSITORY);
  }, 120_000);

  afterAll(() => module.close());

  describe("findById", () => {
    let bucket: any;

    beforeAll(async () => {
      bucket = await store.createBucket({title: {type: "string"}, age: {type: "number"}});
    });

    it("should find the document by its key", async () => {
      const key = await store.insert(bucket, {title: "alpha", age: 3});
      await store.insert(bucket, {title: "beta", age: 4});

      const found = JSON.parse(JSON.stringify(await repository.findById(bucket, key as any)));

      expect(found).toEqual({[store.keyField]: String(key), title: "alpha", age: 3});
    });

    it("should resolve to null when there is no such document", async () => {
      const unknown = module.get<IdTypes>(ID_TYPES).unscoped().generate();

      expect(await repository.findById(bucket, unknown)).toBeNull();
    });

    it("should find a document of a bucket that has a relation property", async () => {
      const authors = await store.createBucket({name: {type: "string"}});
      const author = await store.insert(authors, {name: "ann"});
      const posts = await store.createBucket({
        title: {type: "string"},
        author: {type: "relation", bucketId: String(idOf(authors)), relationType: "onetoone"}
      });
      const key = await store.insert(posts, {title: "first", author: String(author)});

      const found = JSON.parse(JSON.stringify(await repository.findById(posts, key as any)));

      expect(found).toEqual({
        [store.keyField]: String(key),
        title: "first",
        author: String(author)
      });
    });
  });

  describe("status", () => {
    it("should count the documents of one bucket and report its count limit", async () => {
      const bucket = await store.createBucket({title: {type: "string"}});
      await store.insert(bucket, {title: "a"});
      await store.insert(bucket, {title: "b"});

      expect(await repository.statusOf(bucket)).toEqual({
        limit: undefined,
        current: 2,
        unit: "count"
      });

      const limited = {
        ...bucket,
        documentSettings: {countLimit: 5, limitExceedBehaviour: "prevent"}
      };
      expect(await repository.statusOf(limited)).toEqual({limit: 5, current: 2, unit: "count"});
    });

    it("should count the documents of every bucket", async () => {
      const before = (await repository.status()).current;
      const first = await store.createBucket({title: {type: "string"}});
      const second = await store.createBucket({title: {type: "string"}});
      await store.insert(first, {title: "a"});
      await store.insert(second, {title: "b"});
      await store.insert(second, {title: "c"});

      expect(await repository.status()).toEqual({
        limit: undefined,
        current: before + 3,
        unit: "count"
      });
    });
  });

  describe("unsetFields", () => {
    it("should remove the values of the given languages from translated fields", async () => {
      const bucket = await store.createBucket({
        label: {type: "string", options: {translate: true}},
        plain: {type: "string"}
      });
      const key = await store.insert(bucket, {
        label: {en_US: "hello", tr_TR: "merhaba"},
        plain: "x"
      });
      const other = await store.insert(bucket, {label: {tr_TR: "dunya"}, plain: "y"});

      await repository.unsetFields(bucket, [["label", "tr_TR"]]);

      expect((await store.read(bucket, key)).label).toEqual({en_US: "hello"});
      expect((await store.read(bucket, key)).plain).toBe("x");
      expect((await store.read(bucket, other)).plain).toBe("y");
    });

    it("should leave other fields and an unknown language alone", async () => {
      const bucket = await store.createBucket({
        label: {type: "string", options: {translate: true}},
        plain: {type: "string"}
      });
      const key = await store.insert(bucket, {label: {en_US: "hello"}, plain: "x"});

      await repository.unsetFields(bucket, [["label", "de_DE"]]);

      expect((await store.read(bucket, key)).label).toEqual({en_US: "hello"});
    });
  });

  describe("profilerEntries", () => {
    it("should resolve to a list", async () => {
      const bucket = await store.createBucket({title: {type: "string"}});

      expect(await repository.profilerEntries(bucket, {})).toEqual([]);
    });
  });
});
