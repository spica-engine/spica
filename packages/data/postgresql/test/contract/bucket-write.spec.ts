import {Global, Module} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {contractSuite} from "@spica-server/database-testing";
import {BUCKET_DATA_LIMIT} from "@spica-server/interface-bucket";
import {
  BUCKET_WRITE,
  BucketInsertContext,
  BucketWriteFacade
} from "@spica-server/interface-bucket-common";
import {ID_TYPES, IdTypes} from "@spica-server/interface-data";
import {BucketStore, bucketStoreProviders, createBucketStore} from "./bucket-store.js";

@Global()
@Module({
  providers: [{provide: BUCKET_DATA_LIMIT, useValue: 3}],
  exports: [BUCKET_DATA_LIMIT]
})
class TotalLimitModule {}

const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

function writerOver(engine: Parameters<Parameters<typeof contractSuite>[1]>[0], total?: number) {
  let module: TestingModule;
  let store: BucketStore;
  let writes: BucketWriteFacade;
  const known = new Map<string, any>();
  const deleteOne = jest.fn(async () => {});

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module(), ...(total ? [TotalLimitModule] : [])],
      providers: bucketStoreProviders(engine)
    }).compile();
    await module.init();
    store = createBucketStore(engine, module);
    writes = module.get(BUCKET_WRITE);
  }, 120_000);

  afterAll(() => module.close());

  beforeEach(() => deleteOne.mockClear());

  return {
    deleteOne,
    get store() {
      return store;
    },
    get keyField() {
      return store.keyField;
    },
    newKey: () => module.get<IdTypes>(ID_TYPES).unscoped().generate(),
    async bucket(
      properties: Record<string, any>,
      options?: Parameters<BucketStore["createBucket"]>[1]
    ) {
      const bucket = await store.createBucket(properties, options);
      known.set(String(bucket._id), bucket);
      return bucket;
    },
    insert(bucket: any, document: object, options: object = {}) {
      const context: BucketInsertContext = {
        resolveSchema: id => known.get(String(id)),
        deleteOne
      };
      return writes.insert(bucket, document as any, options, context);
    }
  };
}

contractSuite("bucket write: insert", engine => {
  const writer = writerOver(engine);
  const {deleteOne} = writer;

  describe("the saved document", () => {
    const born = new Date("2020-01-02T03:04:05.000Z");
    let bucket: any;

    beforeAll(async () => {
      bucket = await writer.bucket({
        title: {type: "string"},
        age: {type: "number"},
        active: {type: "boolean"},
        born: {type: "date"},
        address: {type: "object", properties: {city: {type: "string"}, zip: {type: "string"}}},
        meta: {type: "json"},
        place: {type: "location", locationType: "Point"}
      });
    });

    it("should be answered with the stored fields and its key", async () => {
      const saved = plain(
        await writer.insert(bucket, {
          title: "alpha",
          age: 3.5,
          active: true,
          born,
          address: {city: "Rome", zip: "00100"},
          meta: {tags: ["a", 1, null], nested: {ok: true}},
          place: {type: "Point", coordinates: [12.5, 41.9]}
        })
      );

      expect(saved).toMatchObject({
        title: "alpha",
        age: 3.5,
        active: true,
        born: born.toISOString(),
        address: {city: "Rome", zip: "00100"},
        meta: {tags: ["a", 1, null], nested: {ok: true}},
        place: {type: "Point", coordinates: [12.5, 41.9]}
      });
      expect(saved[writer.keyField]).toEqual(expect.any(String));
    });

    it("should be the document that is read back", async () => {
      const saved = await writer.insert(bucket, {title: "beta", address: {city: "Oslo"}, born});

      expect(await writer.store.read(bucket, saved[writer.keyField])).toEqual(plain(saved));
    });

    it("should keep the key it was given", async () => {
      const key = writer.newKey();

      const saved = plain(await writer.insert(bucket, {[writer.keyField]: key, title: "given"}));

      expect(saved[writer.keyField]).toBe(String(key));
    });

    it("should get a key of its own when it was given none", async () => {
      const first = plain(await writer.insert(bucket, {title: "one"}));
      const second = plain(await writer.insert(bucket, {title: "two"}));

      expect(first[writer.keyField]).not.toEqual(second[writer.keyField]);
    });
  });

  describe("the count limit", () => {
    it("should refuse documents beyond it when documents are prevented", async () => {
      const bucket = await writer.bucket(
        {title: {type: "string"}},
        {documentSettings: {countLimit: 2, limitExceedBehaviour: "prevent"}}
      );
      await writer.insert(bucket, {title: "a"});
      await writer.insert(bucket, {title: "b"});

      await expect(writer.insert(bucket, {title: "c"})).rejects.toThrow(
        "Maximum number of documents has been reached"
      );
      expect(await writer.store.find(bucket)).toHaveLength(2);
    });

    it("should ask for the oldest document to be deleted when documents are removed", async () => {
      const bucket = await writer.bucket(
        {title: {type: "string"}},
        {documentSettings: {countLimit: 2, limitExceedBehaviour: "remove"}}
      );
      const oldest = plain(await writer.insert(bucket, {title: "a"}))[writer.keyField];
      await writer.insert(bucket, {title: "b"});

      await writer.insert(bucket, {title: "c"}).catch(() => undefined);

      expect(deleteOne).toHaveBeenCalledTimes(1);
      expect(String((deleteOne.mock.calls[0] as unknown[])[0])).toBe(oldest);
    });

    it("should not ask for a deletion while there is room", async () => {
      const bucket = await writer.bucket(
        {title: {type: "string"}},
        {documentSettings: {countLimit: 2, limitExceedBehaviour: "remove"}}
      );

      await writer.insert(bucket, {title: "a"});
      await writer.insert(bucket, {title: "b"});

      expect(deleteOne).not.toHaveBeenCalled();
    });
  });

  describe("the write rule", () => {
    const user = {_id: "u"};

    it("should refuse a document the rule denies and keep nothing", async () => {
      const bucket = await writer.bucket(
        {title: {type: "string"}},
        {acl: {read: "true==true", write: "document.title == 'allowed'"}}
      );

      await expect(
        writer.insert(bucket, {title: "other"}, {applyAcl: true, user})
      ).rejects.toMatchObject({status: 401, message: "ACL rules has rejected this operation."});
      expect(await writer.store.find(bucket)).toEqual([]);

      await writer.insert(bucket, {title: "allowed"}, {applyAcl: true, user});
      expect(await writer.store.find(bucket)).toHaveLength(1);
    });

    it("should not apply the rule unless asked to", async () => {
      const bucket = await writer.bucket(
        {title: {type: "string"}},
        {acl: {read: "true==true", write: "false"}}
      );

      await writer.insert(bucket, {title: "anything"});

      expect(await writer.store.find(bucket)).toHaveLength(1);
    });

    it("should evaluate the rule on the related document", async () => {
      const authors = await writer.bucket({name: {type: "string"}});
      const ann = plain(await writer.insert(authors, {name: "ann"}))[writer.keyField];
      const bob = plain(await writer.insert(authors, {name: "bob"}))[writer.keyField];
      const posts = await writer.bucket(
        {
          title: {type: "string"},
          author: {type: "relation", bucketId: String(authors._id), relationType: "onetoone"}
        },
        {acl: {read: "true==true", write: "document.author.name == 'ann'"}}
      );

      await expect(
        writer.insert(posts, {title: "p", author: bob}, {applyAcl: true, user})
      ).rejects.toMatchObject({status: 401});

      const saved = plain(
        await writer.insert(posts, {title: "p", author: ann}, {applyAcl: true, user})
      );
      expect(saved.author).toBe(ann);
    });
  });
});

contractSuite("bucket write: insert with a total document limit", engine => {
  const writer = writerOver(engine, 3);

  it("should refuse documents beyond the limit across all buckets", async () => {
    const first = await writer.bucket({title: {type: "string"}});
    const second = await writer.bucket({title: {type: "string"}});
    await writer.insert(first, {title: "a"});
    await writer.insert(first, {title: "b"});
    await writer.insert(second, {title: "c"});

    await expect(writer.insert(second, {title: "d"})).rejects.toThrow(
      "Total bucket-data limit exceeded"
    );
    expect(await writer.store.find(second)).toHaveLength(1);
  });
});
