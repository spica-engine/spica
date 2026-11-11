import {Test, TestingModule} from "@nestjs/testing";
import {FilterLanguageError, idOf} from "@spica-server/data";
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

  describe("conditions built by a caller", () => {
    beforeAll(async () => {
      bucket = await seed(PROPERTIES, DOCUMENTS);
    });

    const condition = (path: string[], operator: string, value: unknown) => ({
      path,
      operator,
      value
    });
    const read = async (where: any) => titles(await store.find(bucket, {where, sort: {title: 1}}));

    it.each([
      [condition(["title"], "eq", "beta"), ["beta"]],
      [condition(["age"], "gt", 20), ["alpha", "gamma"]],
      [condition(["age"], "lte", 25), ["beta", "gamma"]],
      [condition(["title"], "ne", "alpha"), ["beta", "delta 100%", "gamma"]],
      [condition(["title"], "in", ["alpha", "gamma", "nope"]), ["alpha", "gamma"]],
      [condition(["title"], "nin", ["alpha", "beta"]), ["delta 100%", "gamma"]],
      [condition(["title"], "regex", "^al"), ["alpha"]],
      [condition(["address", "city"], "eq", "Rome"), ["alpha", "gamma"]],
      [
        {
          or: [condition(["title"], "eq", "alpha"), condition(["title"], "eq", "beta")]
        },
        ["alpha", "beta"]
      ],
      [
        {
          and: [condition(["address", "city"], "eq", "Rome"), condition(["age"], "gt", 25)]
        },
        ["alpha"]
      ]
    ])("%j keeps %j", async (where, expected) => {
      expect(await read(where)).toEqual(expected);
    });

    it("should count what the conditions keep", async () => {
      const page = await store.paginate(bucket, {where: condition(["age"], "gt", 20), limit: 1});
      expect(page.meta).toEqual({total: 2});
    });

    it("should never let a condition reach what the read rule hides", async () => {
      const guarded = await seed(PROPERTIES, DOCUMENTS, {
        acl: {read: `document.age > 20`, write: "true==true"}
      });

      const found = await store.find(guarded, {
        applyAcl: true,
        where: {
          or: [condition(["age"], "lt", 100), condition(["title"], "eq", "beta")]
        }
      });
      expect(titles(found).sort()).toEqual(["alpha", "gamma"]);
    });

    (postgres ? it : it.skip)("should apply together with an expression filter", async () => {
      const found = await store.find(bucket, {
        filter: `document.age > 20`,
        where: condition(["address", "city"], "eq", "Rome"),
        sort: {title: 1}
      });
      expect(titles(found)).toEqual(["alpha", "gamma"]);
    });

    (postgres ? it : it.skip)("should answer 400 for an operator it cannot write", async () => {
      await expect(
        store.find(bucket, {where: condition(["title"], "exists", true)})
      ).rejects.toMatchObject({status: 400});
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

  describe("relations", () => {
    let companies: any;
    let authors: any;
    let posts: any;
    const labels = new Map<string, string>();

    const label = (value: unknown): unknown => {
      if (Array.isArray(value)) {
        return value.map(label);
      }
      if (value && typeof value == "object") {
        return Object.fromEntries(
          Object.entries(value)
            .filter(([name, inner]) => name != "_id" && name != "id" && inner != null)
            .map(([name, inner]) => [name, label(inner)])
        );
      }
      return typeof value == "string" && labels.has(value) ? `<${labels.get(value)}>` : value;
    };

    const insertLabeled = async (bucket: any, name: string, document: any) => {
      const key = await store.insert(bucket, document);
      labels.set(String(key), name);
      return String(key);
    };

    beforeAll(async () => {
      store.reset();
      labels.clear();
      companies = await store.createBucket({name: {type: "string"}});
      const acme = await insertLabeled(companies, "acme", {name: "Acme"});
      const globex = await insertLabeled(companies, "globex", {name: "Globex"});

      authors = await store.createBucket({
        name: {type: "string"},
        company: {type: "relation", bucketId: String(idOf(companies)), relationType: "onetoone"}
      });
      const ann = await insertLabeled(authors, "ann", {name: "Ann", company: acme});
      const bob = await insertLabeled(authors, "bob", {name: "Bob", company: globex});
      const cem = await insertLabeled(authors, "cem", {name: "Cem"});

      posts = await store.createBucket({
        title: {type: "string"},
        author: {type: "relation", bucketId: String(idOf(authors)), relationType: "onetoone"},
        editors: {type: "relation", bucketId: String(idOf(authors)), relationType: "onetomany"},
        meta: {
          type: "object",
          properties: {
            reviewer: {type: "relation", bucketId: String(idOf(authors)), relationType: "onetoone"}
          }
        }
      });
      await insertLabeled(posts, "first", {
        title: "first",
        author: ann,
        editors: [bob, ann],
        meta: {reviewer: cem}
      });
      await insertLabeled(posts, "second", {title: "second", author: bob, editors: [], meta: {}});
      await insertLabeled(posts, "third", {title: "third", editors: [cem]});
    });

    const read = async (relationPaths: string[][], extra: any = {}) =>
      label(await store.find(posts, {sort: {title: 1}, relationPaths, ...extra})) as any[];

    it("should keep the keys of relations nobody asked for", async () => {
      const [first, , third] = await read([]);
      expect(first).toMatchObject({author: "<ann>", editors: ["<bob>", "<ann>"]});
      expect(third.author).toBeUndefined();
    });

    it("should replace a one-to-one relation with the document it points at", async () => {
      const [first, second, third] = await read([["author"]]);

      expect(first.author).toEqual({name: "Ann", company: "<acme>"});
      expect(second.author).toEqual({name: "Bob", company: "<globex>"});
      expect(third.author ?? null).toBeNull();
    });

    it("should resolve every target of a one-to-many relation", async () => {
      const [first, second, third] = await read([["editors"]]);

      expect(first.editors.map((editor: any) => editor.name).sort()).toEqual(["Ann", "Bob"]);
      expect(second.editors).toEqual([]);
      expect(third.editors).toEqual([{name: "Cem"}]);
    });

    it("should resolve a relation nested in an object", async () => {
      const [first, second] = await read([["meta", "reviewer"]]);

      expect(first.meta.reviewer).toEqual({name: "Cem"});
      expect(second.meta.reviewer ?? null).toBeNull();
    });

    it("should resolve relations of relations only when asked to", async () => {
      const [first, second] = await read([["author", "company"]]);

      expect(first.author).toEqual({name: "Ann", company: {name: "Acme"}});
      expect(second.author).toEqual({name: "Bob", company: {name: "Globex"}});
    });

    it("should resolve several relations at once", async () => {
      const [first] = await read([["author", "company"], ["editors"]]);

      expect(first.author.company).toEqual({name: "Acme"});
      expect(first.editors.map((editor: any) => editor.company).sort()).toEqual([
        "<acme>",
        "<globex>"
      ]);
    });

    it("should filter by a field of a related document", async () => {
      const found = await read([["author"]], {filter: `document.author.name == "Bob"`});
      expect(found.map(post => post.title)).toEqual(["second"]);
      expect(found[0].author).toEqual({name: "Bob", company: "<globex>"});
    });

    it("should filter by a field of a related document through conditions", async () => {
      const found = await read([["author", "_id"]], {
        where: {path: ["author", "name"], operator: "eq", value: "Bob"}
      });

      expect(found.map(post => post.title)).toEqual(["second"]);
      expect(found[0].author).toEqual({name: "Bob", company: "<globex>"});
    });

    it("should resolve the relations of a page with a shared target once for every document", async () => {
      const page = await store.paginate(posts, {
        sort: {title: 1},
        relationPaths: [["author"]],
        limit: 2
      });

      expect(page.meta).toEqual({total: 3});
      expect(page.data.map((post: any) => post.author.name)).toEqual(["Ann", "Bob"]);
    });

    it("should leave out a relation a field rule hides", async () => {
      const guarded = await store.createBucket({
        title: {type: "string"},
        author: {
          type: "relation",
          bucketId: String(idOf(authors)),
          relationType: "onetoone",
          acl: `auth.role == "admin"`
        }
      });
      const ann = [...labels].find(([, name]) => name == "ann")![0];
      await store.insert(guarded, {title: "g", author: ann});

      const [asGuest] = await store.find(guarded, {
        relationPaths: [["author"]],
        applyAcl: true,
        user: {role: "guest"}
      });
      const [asAdmin] = await store.find(guarded, {
        relationPaths: [["author"]],
        applyAcl: true,
        user: {role: "admin"}
      });

      expect(asGuest).not.toHaveProperty("author");
      expect((label(asAdmin) as any).author).toEqual({name: "Ann", company: "<acme>"});
    });

    it("should ignore a path that is not a relation", async () => {
      const [first] = await read([["title"], ["nope"], ["meta"]]);
      expect(first.title).toBe("first");
    });
  });

  describe("locale", () => {
    const TR = {best: "tr_TR", fallback: "en_US"};
    const DOCUMENTS = {
      one: {label: {en_US: "hello", tr_TR: "merhaba"}, plain: "a"},
      two: {label: {en_US: "world"}, plain: "b"},
      three: {label: {fr_FR: "bonjour"}, plain: "c"}
    };
    let translated: any;

    beforeAll(async () => {
      translated = await seed(
        {label: {type: "string", options: {translate: true}}, plain: {type: "string"}},
        DOCUMENTS
      );
    });

    const labels = (documents: any[]) => documents.map(document => document.label);

    it("should return every language when localization is not asked for", async () => {
      const {result, locale} = await store.localized(translated, {sort: {plain: 1}});

      expect(labels(result)).toEqual([
        DOCUMENTS.one.label,
        DOCUMENTS.two.label,
        DOCUMENTS.three.label
      ]);
      expect(locale).toBeUndefined();
    });

    it("should pick the requested language, then the default one, then give every language", async () => {
      const {result, locale} = await store.localized(translated, {
        localize: true,
        language: "tr",
        sort: {plain: 1}
      });

      expect(labels(result)).toEqual(["merhaba", "world", DOCUMENTS.three.label]);
      expect(locale).toEqual(TR);
    });

    it("should fall back to the default language when the requested one is not supported", async () => {
      const {result, locale} = await store.localized(translated, {
        localize: true,
        language: "de",
        sort: {plain: 1}
      });

      expect(labels(result).slice(0, 2)).toEqual(["hello", "world"]);
      expect(locale).toEqual({best: "en_US", fallback: "en_US"});
    });

    it("should filter on the language the documents are read in", async () => {
      const filter = `document.label == "merhaba"`;
      const turkish = await store.localized(translated, {localize: true, language: "tr", filter});
      const english = await store.localized(translated, {localize: true, language: "en", filter});

      expect(turkish.result.map(document => document.plain)).toEqual(["a"]);
      expect(english.result).toEqual([]);
    });

    it("should sort by the language the documents are read in", async () => {
      const {result} = await store.localized(translated, {
        localize: true,
        language: "tr",
        sort: {label: 1}
      });

      const order = (documents: any[]) =>
        documents.map(document => document.plain).filter(plain => plain != "c");
      expect(order(result)).toEqual(["a", "b"]);

      const descending = await store.localized(translated, {
        localize: true,
        language: "tr",
        sort: {label: -1}
      });
      expect(order(descending.result)).toEqual(["b", "a"]);
    });

    it("should count what a translated filter keeps", async () => {
      const page = await store.paginate(translated, {
        localize: true,
        language: "en",
        filter: `startsWith(document.label, "h")`
      });
      expect(page.meta).toEqual({total: 1});
    });

    it("should not report a language for a bucket without translated fields", async () => {
      const plain = await seed({title: {type: "string"}}, {a: {title: "a"}});
      const {locale} = await store.localized(plain, {localize: true, language: "tr"});
      expect(locale).toBeUndefined();
    });

    it("should read the related documents in the same language", async () => {
      const authors = await seed(
        {bio: {type: "string", options: {translate: true}}},
        {ann: {bio: {en_US: "writer", tr_TR: "yazar"}}}
      );
      const ann = String(keys.ann);
      const posts = await store.createBucket({
        title: {type: "string", options: {translate: true}},
        author: {type: "relation", bucketId: String(idOf(authors)), relationType: "onetoone"}
      });
      await store.insert(posts, {title: {en_US: "p"}, author: ann});

      const {result} = await store.localized(posts, {
        localize: true,
        language: "tr",
        relationPaths: [["author", "_id"]]
      });
      expect(result[0].author.bio).toBe("yazar");
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
