import {Global, Module} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {encrypt} from "@spica-server/core-encryption";
import {applyPatch} from "@spica-server/core-patch";
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
    replace(bucket: any, document: object, options: object = {}, extra: object = {}) {
      return writes.replace(bucket, document as any, options, {
        resolveSchema: id => known.get(String(id)),
        ...extra
      });
    },
    patch(bucket: any, document: object, patch: object, options: object = {}, extra: object = {}) {
      return writes.patch(bucket, document as any, patch, options, {
        resolveSchema: id => known.get(String(id)),
        ...extra
      });
    },
    insert(bucket: any, document: object, options: object = {}, extra: object = {}) {
      const context: BucketInsertContext = {
        resolveSchema: id => known.get(String(id)),
        deleteOne,
        ...extra
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

  describe("lists, translations and links", () => {
    const secrets = {hashSecret: "hash-secret", encryptionSecret: "encryption-secret"};
    let authors: any;
    let ann: string;
    let bob: string;
    let bucket: any;

    beforeAll(async () => {
      authors = await writer.bucket({name: {type: "string"}});
      ann = plain(await writer.insert(authors, {name: "ann"}))[writer.keyField];
      bob = plain(await writer.insert(authors, {name: "bob"}))[writer.keyField];
      bucket = await writer.bucket({
        title: {type: "string"},
        tags: {type: "array", items: {type: "string"}},
        scores: {type: "array", items: {type: "number"}},
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              sku: {type: "string"},
              qty: {type: "number"},
              size: {type: "object", properties: {w: {type: "number"}, h: {type: "number"}}}
            }
          }
        },
        label: {type: "string", options: {translate: true}},
        editors: {type: "relation", bucketId: String(authors._id), relationType: "onetomany"},
        meta: {type: "object", properties: {tags: {type: "array", items: {type: "string"}}}},
        codes: {type: "array", items: {type: "encrypted"}}
      });
    });

    const document = () => ({
      title: "all",
      tags: ["b", "a"],
      scores: [3, 1, 2],
      lines: [
        {sku: "x", qty: 2, size: {w: 1, h: 2}},
        {sku: "y", qty: 5, size: {w: 3, h: 4}}
      ],
      label: {en_US: "hello", tr_TR: "merhaba"},
      editors: [bob, ann],
      meta: {tags: ["m", "n"]}
    });

    it("should be answered with every list, translation and link it was given", async () => {
      const saved = plain(await writer.insert(bucket, document()));

      expect(saved).toMatchObject(document());
    });

    it("should be read back as it was written", async () => {
      const saved = await writer.insert(bucket, document());

      const read = await writer.store.read(bucket, saved[writer.keyField]);

      expect(read).toEqual(plain(saved));
    });

    it("should keep the order of the items of a list", async () => {
      const saved = plain(await writer.insert(bucket, {...document(), scores: [9, 8, 7, 8]}));

      expect(saved.scores).toEqual([9, 8, 7, 8]);
    });

    it("should answer an empty list as an empty list", async () => {
      const saved = plain(await writer.insert(bucket, {title: "none", tags: []}));

      expect(saved.tags).toEqual([]);
    });

    it("should decrypt the encrypted items of a list when the encryption secret is known", async () => {
      const code = (value: string) => encrypt(value, secrets.encryptionSecret, secrets.hashSecret);

      const saved = await writer.insert(
        bucket,
        {title: "codes", codes: [code("1234"), code("5678")]},
        {},
        secrets
      );

      expect(saved.codes).toEqual(["1234", "5678"]);
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

  describe("encrypted fields", () => {
    const secrets = {hashSecret: "hash-secret", encryptionSecret: "encryption-secret"};
    const encrypted = (value: string) =>
      encrypt(value, secrets.encryptionSecret, secrets.hashSecret);
    let bucket: any;

    beforeAll(async () => {
      bucket = await writer.bucket({
        title: {type: "string"},
        secret: {type: "encrypted"},
        profile: {type: "object", properties: {pin: {type: "encrypted"}}}
      });
    });

    it("should be answered as the encrypted data with its hash", async () => {
      const value = encrypted("hello");

      const saved = plain(await writer.insert(bucket, {title: "a", secret: value}));

      expect(saved.secret).toEqual(value);
    });

    it("should be read back as it was written", async () => {
      const value = encrypted("hello");
      const saved = await writer.insert(bucket, {
        title: "b",
        secret: value,
        profile: {pin: encrypted("1234")}
      });

      const read = await writer.store.read(bucket, saved[writer.keyField]);

      expect(read.secret).toEqual(plain(value));
      expect(read.profile.pin).toEqual(plain(plain(saved).profile.pin));
    });

    it("should be answered decrypted when the encryption secret is known", async () => {
      const saved = await writer.insert(
        bucket,
        {title: "c", secret: encrypted("hello"), profile: {pin: encrypted("1234")}},
        {},
        secrets
      );

      expect(saved.secret).toBe("hello");
      expect(saved.profile.pin).toBe("1234");
    });

    it("should leave a missing encrypted field out", async () => {
      const saved = plain(await writer.insert(bucket, {title: "d"}));

      expect(saved.secret ?? null).toBeNull();
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

    it("should compare an encrypted field with a value written in the rule", async () => {
      const secrets = {hashSecret: "hash-secret", encryptionSecret: "encryption-secret"};
      const bucket = await writer.bucket(
        {title: {type: "string"}, secret: {type: "encrypted"}},
        {acl: {read: "true==true", write: "document.secret == 'open sesame'"}}
      );
      const options = {applyAcl: true, user};

      await expect(
        writer.insert(
          bucket,
          {title: "a", secret: encrypt("wrong", secrets.encryptionSecret, secrets.hashSecret)},
          options,
          secrets
        )
      ).rejects.toMatchObject({status: 401});

      await writer.insert(
        bucket,
        {title: "a", secret: encrypt("open sesame", secrets.encryptionSecret, secrets.hashSecret)},
        options,
        secrets
      );
      expect(await writer.store.find(bucket)).toHaveLength(1);
    });

    it("should compare an encrypted field of the related document", async () => {
      const secrets = {hashSecret: "hash-secret", encryptionSecret: "encryption-secret"};
      const sealed = (value: string) =>
        encrypt(value, secrets.encryptionSecret, secrets.hashSecret);
      const authors = await writer.bucket({name: {type: "string"}, pin: {type: "encrypted"}});
      const ann = plain(await writer.insert(authors, {name: "ann", pin: sealed("1234")}));
      const bob = plain(await writer.insert(authors, {name: "bob", pin: sealed("0000")}));
      const posts = await writer.bucket(
        {
          title: {type: "string"},
          author: {type: "relation", bucketId: String(authors._id), relationType: "onetoone"}
        },
        {acl: {read: "true==true", write: "document.author.pin == '1234'"}}
      );
      const options = {applyAcl: true, user};

      await expect(
        writer.insert(posts, {title: "p", author: bob[writer.keyField]}, options, secrets)
      ).rejects.toMatchObject({status: 401});

      const saved = plain(
        await writer.insert(posts, {title: "p", author: ann[writer.keyField]}, options, secrets)
      );
      expect(saved.author).toBe(ann[writer.keyField]);
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

contractSuite("bucket write: replace and patch", engine => {
  const writer = writerOver(engine);
  const user = {_id: "u"};
  let authors: any;
  let ann: string;
  let bob: string;
  let bucket: any;

  beforeAll(async () => {
    authors = await writer.bucket({name: {type: "string"}});
    ann = plain(await writer.insert(authors, {name: "ann"}))[writer.keyField];
    bob = plain(await writer.insert(authors, {name: "bob"}))[writer.keyField];
    bucket = await writer.bucket({
      title: {type: "string"},
      age: {type: "number"},
      address: {type: "object", properties: {city: {type: "string"}, zip: {type: "string"}}},
      tags: {type: "array", items: {type: "string"}},
      lines: {
        type: "array",
        items: {type: "object", properties: {sku: {type: "string"}, qty: {type: "number"}}}
      },
      label: {type: "string", options: {translate: true}},
      editors: {type: "relation", bucketId: String(authors._id), relationType: "onetomany"}
    });
  });

  const original = () => ({
    title: "first",
    age: 30,
    address: {city: "Rome", zip: "00100"},
    tags: ["a", "b", "c"],
    lines: [
      {sku: "x", qty: 1},
      {sku: "y", qty: 2}
    ],
    label: {en_US: "hello", tr_TR: "merhaba"},
    editors: [ann, bob]
  });

  async function stored() {
    const saved = await writer.insert(bucket, original());
    return {
      key: saved[writer.keyField],
      read: () => writer.store.read(bucket, saved[writer.keyField])
    };
  }

  describe("replace", () => {
    it("should answer with the document before the replacement and store the new one", async () => {
      const {key, read} = await stored();
      const next = {
        [writer.keyField]: key,
        title: "second",
        age: 31,
        address: {city: "Oslo", zip: "0150"},
        tags: ["z"],
        lines: [{sku: "q", qty: 9}],
        label: {en_US: "bye"},
        editors: [bob]
      };

      const previous = plain(await writer.replace(bucket, next, {}));

      expect(previous).toMatchObject(original());
      expect(await read()).toMatchObject(plain(next));
    });

    it("should answer with the new document when asked for the document after", async () => {
      const {key, read} = await stored();
      const next = {...original(), [writer.keyField]: key, title: "after", tags: ["n"]};

      const current = plain(await writer.replace(bucket, next, {returnDocument: "after"}));

      expect(current).toEqual(await read());
      expect(current).toMatchObject({title: "after", tags: ["n"]});
    });

    it("should leave a list, a translation and links empty when the new document has none", async () => {
      const {key, read} = await stored();

      await writer.replace(bucket, {[writer.keyField]: key, title: "bare"}, {});

      const now = await read();
      expect(now.title).toBe("bare");
      expect(now.tags ?? []).toEqual([]);
      expect(now.lines ?? []).toEqual([]);
      expect(now.editors ?? []).toEqual([]);
      expect(Object.keys(now.label ?? {})).toEqual([]);
    });

    it("should change nothing else in the bucket", async () => {
      const {key} = await stored();
      const other = await stored();

      await writer.replace(bucket, {[writer.keyField]: key, title: "changed"}, {});

      expect(await other.read()).toMatchObject(original());
    });

    it("should answer null for a document that does not exist", async () => {
      const missing = writer.newKey();

      expect(await writer.replace(bucket, {[writer.keyField]: missing, title: "x"}, {})).toBeNull();
      expect((await writer.store.find(bucket)).some(found => found.title == "x")).toBe(false);
    });

    it("should refuse a replacement the write rule denies and keep the document", async () => {
      const guarded = await writer.bucket(
        {title: {type: "string"}},
        {acl: {read: "true==true", write: "document.title == 'allowed'"}}
      );
      const saved = await writer.insert(guarded, {title: "allowed"});
      const key = saved[writer.keyField];

      await expect(
        writer.replace(guarded, {[writer.keyField]: key, title: "other"}, {applyAcl: true, user})
      ).rejects.toMatchObject({status: 401});

      expect((await writer.store.read(guarded, key)).title).toBe("allowed");
    });
  });

  describe("patch", () => {
    const patching = async (patch: object, options: object = {returnDocument: "after"}) => {
      const {key, read} = await stored();
      const merged = {...applyPatch(original(), patch), [writer.keyField]: key};
      const answered = plain(await writer.patch(bucket, merged, patch, options));
      return {answered, read, merged};
    };

    it("should change the given fields and keep the others", async () => {
      const {answered, read} = await patching({title: "patched", age: 32});

      expect(answered).toMatchObject({...original(), title: "patched", age: 32});
      expect(await read()).toEqual(answered);
    });

    it("should change a field of an object and keep its siblings", async () => {
      const {read} = await patching({address: {city: "Oslo"}});

      expect((await read()).address).toEqual({city: "Oslo", zip: "00100"});
    });

    it("should remove the fields that are patched to null", async () => {
      const {read} = await patching({age: null, address: {zip: null}});

      const now = await read();
      expect(now.age ?? null).toBeNull();
      expect(now.address.zip ?? null).toBeNull();
      expect(now.address.city).toBe("Rome");
    });

    it("should replace a whole list", async () => {
      const {read} = await patching({tags: ["only"], lines: [{sku: "n", qty: 5}]});

      const now = await read();
      expect(now.tags).toEqual(["only"]);
      expect(now.lines).toEqual([{sku: "n", qty: 5}]);
    });

    it("should change one language of a translation and keep the other", async () => {
      const {read} = await patching({label: {tr_TR: "selam"}});

      expect((await read()).label).toEqual({en_US: "hello", tr_TR: "selam"});
    });

    it("should remove a language patched to null", async () => {
      const {read} = await patching({label: {tr_TR: null}});

      expect((await read()).label).toEqual({en_US: "hello"});
    });

    it("should replace the links of a relation", async () => {
      const {read} = await patching({editors: [bob]});

      expect((await read()).editors).toEqual([bob]);
    });

    it("should answer with the document before the patch by default", async () => {
      const {answered, read} = await patching({title: "later"}, {});

      expect(answered.title).toBe("first");
      expect((await read()).title).toBe("later");
    });

    it("should answer null for a document that does not exist", async () => {
      const merged = {[writer.keyField]: writer.newKey(), title: "x"};

      expect(await writer.patch(bucket, merged, {title: "x"}, {})).toBeNull();
    });

    it("should refuse a patch the write rule denies and keep the document", async () => {
      const guarded = await writer.bucket(
        {title: {type: "string"}},
        {acl: {read: "true==true", write: "document.title == 'allowed'"}}
      );
      const key = (await writer.insert(guarded, {title: "allowed"}))[writer.keyField];

      await expect(
        writer.patch(
          guarded,
          {[writer.keyField]: key, title: "other"},
          {title: "other"},
          {applyAcl: true, user}
        )
      ).rejects.toMatchObject({status: 401});

      expect((await writer.store.read(guarded, key)).title).toBe("allowed");
    });
  });
});
