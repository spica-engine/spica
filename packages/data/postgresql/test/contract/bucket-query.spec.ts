import {Test, TestingModule} from "@nestjs/testing";
import {FilterLanguageError} from "@spica-server/data";
import {contractSuite} from "@spica-server/database-testing";
import {ID_TYPES, IdTypes} from "@spica-server/interface-data";
import {BucketStore, bucketStoreProviders, createBucketStore} from "./bucket-store.js";

const PROPERTIES = {
  title: {type: "string"},
  age: {type: "number"},
  active: {type: "boolean"},
  tags: {type: "array", items: {type: "string"}},
  address: {type: "object", properties: {city: {type: "string"}}}
};

const DOCUMENTS = {
  alpha: {title: "alpha", age: 30, active: true, tags: ["x", "y"], address: {city: "Rome"}},
  beta: {title: "beta", age: 20, active: false, tags: ["y"], address: {city: "Oslo"}},
  gamma: {title: "gamma", age: 25, active: true, tags: [], address: {city: "Rome"}},
  delta: {title: "delta 100%", active: false}
};

contractSuite("bucket query", engine => {
  let module: TestingModule;
  let store: BucketStore;
  let bucket: any;
  const keys: Record<string, unknown> = {};
  const postgres = engine.name == "postgresql";

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module()],
      providers: bucketStoreProviders(engine)
    }).compile();
    await module.init();
    store = createBucketStore(engine, module);
  }, 120_000);

  afterAll(() => module.close());

  async function seed(
    properties: Record<string, any>,
    documents: Record<string, any>,
    options?: any
  ) {
    store.reset();
    const created = await store.createBucket(properties, options);
    for (const [label, document] of Object.entries(documents)) {
      keys[label] = await store.insert(created, document);
    }
    return created;
  }

  const titles = (documents: any[]) => documents.map(document => document.title);
  const keyOf = (label: string) => String(keys[label]);

  describe("plain reads", () => {
    beforeAll(async () => {
      bucket = await seed(PROPERTIES, DOCUMENTS);
    });

    it("should return every document in the order they were written", async () => {
      expect(titles(await store.find(bucket))).toEqual(["alpha", "beta", "gamma", "delta 100%"]);
    });

    it("should return the same document shape as the shaper", async () => {
      const [alpha] = await store.find(bucket, {limit: 1});
      expect(alpha).toMatchObject(DOCUMENTS.alpha);
      expect(alpha).toHaveProperty(store.keyField);
    });

    it("should sort ascending with missing values first, and descending with them last", async () => {
      expect(titles(await store.find(bucket, {sort: {age: 1}}))).toEqual([
        "delta 100%",
        "beta",
        "gamma",
        "alpha"
      ]);
      expect(titles(await store.find(bucket, {sort: {age: -1}}))).toEqual([
        "alpha",
        "gamma",
        "beta",
        "delta 100%"
      ]);
    });

    it("should sort by a nested field and by several fields", async () => {
      expect(titles(await store.find(bucket, {sort: {"address.city": 1, title: -1}}))).toEqual([
        "delta 100%",
        "beta",
        "gamma",
        "alpha"
      ]);
    });

    it("should skip and limit", async () => {
      expect(titles(await store.find(bucket, {sort: {age: -1}, skip: 1, limit: 2}))).toEqual([
        "gamma",
        "beta"
      ]);
      expect(titles(await store.find(bucket, {sort: {age: -1}, skip: 3}))).toEqual(["delta 100%"]);
    });

    it("should return one document by its key", async () => {
      const document = await store.find(bucket, {documentId: keys.beta as any});
      expect(titles(document)).toEqual(["beta"]);
    });

    it("should return nothing for a key that does not exist", async () => {
      const missing = module.get<IdTypes>(ID_TYPES).unscoped().generate();
      expect(await store.find(bucket, {documentId: missing})).toEqual([]);
    });

    it("should keep the requested fields and the key", async () => {
      const [document] = await store.find(bucket, {
        sort: {age: -1},
        limit: 1,
        projectMap: [["title"], ["address", "city"]]
      });
      expect(document).toEqual({
        [store.keyField]: keyOf("alpha"),
        title: "alpha",
        address: {city: "Rome"}
      });
    });
  });

  describe("resource filter", () => {
    beforeAll(async () => {
      bucket = await seed(PROPERTIES, DOCUMENTS);
    });

    it("should keep the included keys", async () => {
      const found = await store.find(bucket, {
        resourceFilter: {include: [keyOf("beta"), keyOf("gamma")], exclude: []}
      });
      expect(titles(found)).toEqual(["beta", "gamma"]);
    });

    it("should drop the excluded keys", async () => {
      const found = await store.find(bucket, {
        resourceFilter: {include: [], exclude: [[keyOf("alpha")]]}
      });
      expect(titles(found)).toEqual(["beta", "gamma", "delta 100%"]);
    });
  });

  describe("expression filter", () => {
    beforeAll(async () => {
      bucket = await seed(PROPERTIES, DOCUMENTS);
    });

    it.each([
      [`document.age > 20`, ["alpha", "gamma"]],
      [`document.title == "beta"`, ["beta"]],
      [`document.age >= 20 && document.active == true`, ["alpha", "gamma"]],
      [`document.title == "alpha" || document.title == "beta"`, ["alpha", "beta"]],
      [`!(document.active == true)`, ["beta", "delta 100%"]],
      [`document.address.city == "Rome"`, ["alpha", "gamma"]],
      [`has(document.age)`, ["alpha", "beta", "gamma"]],
      [`some(document.tags, ["y"])`, ["alpha", "beta"]],
      [`document.title in ["alpha", "gamma", "nope"]`, ["alpha", "gamma"]],
      [`startsWith(document.title, "ga")`, ["gamma"]],
      [`contains(document.title, "lta 100%")`, ["delta 100%"]],
      [`contains(document.title, "%")`, ["delta 100%"]]
    ])("%s keeps %j", async (filter, expected) => {
      expect(titles(await store.find(bucket, {filter, sort: {title: 1}}))).toEqual(
        [...expected].sort()
      );
    });

    it("should combine with sort and paging", async () => {
      const found = await store.find(bucket, {
        filter: `document.age > 10`,
        sort: {age: -1},
        skip: 1,
        limit: 1
      });
      expect(titles(found)).toEqual(["gamma"]);
    });
  });

  describe("pagination", () => {
    beforeAll(async () => {
      bucket = await seed(PROPERTIES, DOCUMENTS);
    });

    it("should count the whole bucket", async () => {
      const page = await store.paginate(bucket, {sort: {age: -1}, limit: 2});
      expect(page.meta).toEqual({total: 4});
      expect(titles(page.data)).toEqual(["alpha", "gamma"]);
    });

    it("should count only what the filter keeps", async () => {
      const page = await store.paginate(bucket, {filter: `document.age > 20`, limit: 1});
      expect(page.meta).toEqual({total: 2});
      expect(page.data).toHaveLength(1);
    });

    it("should count an empty result", async () => {
      expect(await store.paginate(bucket, {filter: `document.age > 1000`})).toEqual({
        meta: {total: 0},
        data: []
      });
    });
  });

  describe("access control", () => {
    const FIELD_RULES = {
      ...PROPERTIES,
      secret: {type: "string", acl: `auth.role == "admin"`}
    };
    const WITH_SECRETS = Object.fromEntries(
      Object.entries(DOCUMENTS).map(([label, document]) => [
        label,
        {...document, secret: `s-${label}`}
      ])
    );

    it("should apply the read rule only when asked to", async () => {
      bucket = await seed(PROPERTIES, DOCUMENTS, {
        acl: {read: `document.age > 20`, write: "true==true"}
      });

      expect(titles(await store.find(bucket, {sort: {title: 1}}))).toHaveLength(4);
      expect(titles(await store.find(bucket, {applyAcl: true, sort: {title: 1}}))).toEqual([
        "alpha",
        "gamma"
      ]);
    });

    it("should read the caller from the rule", async () => {
      bucket = await seed(PROPERTIES, DOCUMENTS, {
        acl: {read: `auth.role == "admin" || document.active == false`, write: "true==true"}
      });

      const read = (role: string) =>
        store.find(bucket, {applyAcl: true, user: {role}, sort: {title: 1}}).then(titles);
      expect(await read("guest")).toEqual(["beta", "delta 100%"]);
      expect(await read("admin")).toEqual(["alpha", "beta", "delta 100%", "gamma"]);
    });

    it("should count only the documents the read rule lets through", async () => {
      bucket = await seed(PROPERTIES, DOCUMENTS, {
        acl: {read: `document.age > 20`, write: "true==true"}
      });

      const page = await store.paginate(bucket, {applyAcl: true, limit: 1});
      expect(page.meta).toEqual({total: 2});
    });

    it("should never let a filter reach what the read rule hides", async () => {
      bucket = await seed(PROPERTIES, DOCUMENTS, {
        acl: {read: `document.age > 20`, write: "true==true"}
      });

      const found = await store.find(bucket, {
        applyAcl: true,
        filter: `document.age < 100 || document.title == "beta"`
      });
      expect(titles(found).sort()).toEqual(["alpha", "gamma"]);
    });

    it("should return nothing when the read rule never holds", async () => {
      bucket = await seed(PROPERTIES, DOCUMENTS, {acl: {read: "false==true", write: "true==true"}});

      expect(await store.find(bucket, {applyAcl: true})).toEqual([]);
      expect(await store.paginate(bucket, {applyAcl: true})).toEqual({meta: {total: 0}, data: []});
    });

    it("should hide a field from a caller the field rule turns away", async () => {
      bucket = await seed(FIELD_RULES, WITH_SECRETS);

      const guest = await store.find(bucket, {applyAcl: true, user: {role: "guest"}, limit: 1});
      const admin = await store.find(bucket, {applyAcl: true, user: {role: "admin"}, limit: 1});
      expect(guest[0]).not.toHaveProperty("secret");
      expect(admin[0]).toHaveProperty("secret", "s-alpha");
    });

    it("should show every field when the rules are not applied", async () => {
      bucket = await seed(FIELD_RULES, WITH_SECRETS);

      const [document] = await store.find(bucket, {limit: 1});
      expect(document).toHaveProperty("secret", "s-alpha");
    });
  });

  (postgres ? describe : describe.skip)("on PostgreSQL", () => {
    beforeAll(async () => {
      bucket = await seed(PROPERTIES, DOCUMENTS);
    });

    it("should answer 404 for a MongoDB filter", async () => {
      await expect(store.find(bucket, {filter: {title: "alpha"}})).rejects.toBeInstanceOf(
        FilterLanguageError
      );
      await expect(store.paginate(bucket, {filter: {title: "alpha"}})).rejects.toBeInstanceOf(
        FilterLanguageError
      );
    });

    it("should accept an empty MongoDB filter", async () => {
      expect(await store.find(bucket, {filter: {}})).toHaveLength(4);
    });

    it.each([
      [`document.title == "a"; DROP TABLE bucket_x`],
      [`document.nope == 1`],
      [`document.title == auth.role`],
      [`document.title ==`]
    ])("should answer 400 for the filter %s", async filter => {
      await expect(store.find(bucket, {filter})).rejects.toMatchObject({status: 400});
    });

    it("should answer 400 for a field it cannot sort by", async () => {
      await expect(store.find(bucket, {sort: {tags: 1}})).rejects.toMatchObject({status: 400});
      await expect(store.find(bucket, {sort: {nope: 1}})).rejects.toMatchObject({status: 400});
    });

    it("should keep a filter value from being read as SQL", async () => {
      const found = await store.find(bucket, {
        filter: `document.title == "alpha' OR '1'='1"`
      });
      expect(found).toEqual([]);
    });
  });
});
