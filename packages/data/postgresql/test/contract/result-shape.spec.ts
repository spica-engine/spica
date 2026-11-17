import {Test, TestingModule} from "@nestjs/testing";
import {contractSuite, ENGINE_KEY_FIELDS} from "@spica-server/database-testing";
import {BucketStore, bucketStoreProviders, createBucketStore} from "./bucket-store.js";
import {idOf} from "@spica-server/data";

const TR = {best: "tr_TR", fallback: "en_US"};

type Fixture = Record<string, any>;

contractSuite("result shape", engine => {
  let module: TestingModule;
  let store: BucketStore;
  let labels: Map<string, string>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module()],
      providers: bucketStoreProviders(engine)
    }).compile();
    await module.init();
    store = createBucketStore(engine, module);
  }, 120_000);

  afterAll(() => module.close());

  beforeEach(() => {
    store.reset();
    labels = new Map();
  });

  async function insert(bucket: any, label: string, document: Fixture) {
    const key = await store.insert(bucket, document);
    labels.set(String(key), label);
    return key;
  }

  async function read(bucket: any, key: unknown, resolve: string[] = [], locale?: typeof TR) {
    return normalize(await store.read(bucket, key, {resolve, locale}));
  }

  function normalize(value: any): any {
    if (Array.isArray(value)) {
      return value.map(normalize);
    }
    if (value && typeof value == "object") {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([name]) => !Object.values(ENGINE_KEY_FIELDS).includes(name))
          .map(([name, inner]) => [name, normalize(inner)])
      );
    }
    return typeof value == "string" && labels.has(value) ? `<${labels.get(value)}>` : value;
  }

  async function shaped(properties: Fixture, document: Fixture, resolve?: string[], locale?: any) {
    const bucket = await store.createBucket(properties);
    const key = await insert(bucket, "document", document);
    return {bucket, key, document: await read(bucket, key, resolve, locale)};
  }

  const expected = (document: Fixture) => JSON.parse(JSON.stringify(document));

  describe("scalar fields", () => {
    const properties = {
      title: {type: "string"},
      note: {type: "textarea"},
      body: {type: "richtext"},
      tint: {type: "color"},
      file: {type: "storage"},
      count: {type: "number"},
      done: {type: "boolean"},
      at: {type: "date"},
      payload: {type: "json"},
      place: {type: "location", locationType: "Point"},
      kind: {type: "string", enum: ["a", "b"]}
    };

    it("should serialize every scalar type like MongoDB", async () => {
      const document = {
        title: "a",
        note: "n",
        body: "<p>b</p>",
        tint: "#fff",
        file: "https://example.com/f.png",
        count: 12.5,
        done: true,
        at: new Date("2024-05-06T07:08:09.123Z"),
        payload: {nested: [1, "two", {three: null}]},
        place: {type: "Point", coordinates: [29.5, 41.25]},
        kind: "b"
      };

      expect((await shaped(properties, document)).document).toEqual(expected(document));
    });

    it("should serialize NULL values as null", async () => {
      const document = Object.fromEntries(Object.keys(properties).map(name => [name, null]));

      expect((await shaped(properties, document)).document).toEqual(expected(document));
    });
  });

  describe("object fields", () => {
    const properties = {
      address: {
        type: "object",
        properties: {
          city: {type: "string"},
          geo: {type: "object", properties: {lat: {type: "number"}, lng: {type: "number"}}}
        }
      },
      empty: {
        type: "object",
        properties: {a: {type: "string"}}
      },
      free: {type: "object"}
    };

    it("should nest objects, keep free-form ones and emit {} for an object of NULLs", async () => {
      const document = {
        address: {city: "x", geo: {lat: 1.5, lng: null}},
        empty: {},
        free: {anything: ["goes", 1]}
      };

      expect((await shaped(properties, document)).document).toEqual(expected(document));
    });
  });

  describe("array fields", () => {
    const properties = {
      tags: {type: "array", items: {type: "string"}},
      picks: {type: "multiselect", items: {type: "string", enum: ["a", "b", "c"]}},
      lines: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: {type: "string"},
            size: {type: "object", properties: {w: {type: "number"}, h: {type: "number"}}}
          }
        }
      },
      nothing: {type: "array", items: {type: "number"}},
      loose: {type: "array"}
    };

    it("should keep items in order and emit [] for an empty array", async () => {
      const document = {
        tags: ["z", "a", "m"],
        picks: ["c", "a"],
        lines: [
          {name: "one", size: {w: 1, h: 2}},
          {name: "two", size: {w: 3, h: 4}}
        ],
        nothing: [],
        loose: [1, "a", {b: null}]
      };

      expect((await shaped(properties, document)).document).toEqual(expected(document));
    });
  });

  describe("relation fields", () => {
    async function setup() {
      const target = await store.createBucket({
        name: {type: "string"},
        tags: {type: "array", items: {type: "string"}}
      });
      const first = await insert(target, "first", {name: "first", tags: ["x"]});
      const second = await insert(target, "second", {name: "second", tags: []});
      const owner = await store.createBucket({
        title: {type: "string"},
        one: {type: "relation", bucketId: String(idOf(target)), relationType: "onetoone"},
        many: {type: "relation", bucketId: String(idOf(target)), relationType: "onetomany"}
      });
      const key = await insert(owner, "owner", {
        title: "o",
        one: String(first),
        many: [String(first), String(second)]
      });
      return {owner, key};
    }

    it("should keep keys for relations that are not resolved", async () => {
      const {owner, key} = await setup();

      expect(await read(owner, key)).toEqual({
        title: "o",
        one: "<first>",
        many: ["<first>", "<second>"]
      });
    });

    it("should replace resolved relations with the target documents", async () => {
      const {owner, key} = await setup();

      expect(await read(owner, key, ["one", "many"])).toEqual({
        title: "o",
        one: {name: "first", tags: ["x"]},
        many: [
          {name: "first", tags: ["x"]},
          {name: "second", tags: []}
        ]
      });
    });
  });

  describe("translated fields", () => {
    const properties = {
      title: {type: "string", options: {translate: true}},
      views: {type: "number", options: {translate: true}},
      plain: {type: "string"}
    };
    const document = {
      title: {en_US: "hello", tr_TR: "merhaba"},
      views: {en_US: 3},
      plain: "p"
    };

    it("should return every locale when none is requested", async () => {
      expect((await shaped(properties, document)).document).toEqual(expected(document));
    });

    it("should return the requested locale, falling back to the default", async () => {
      expect((await shaped(properties, document, [], TR)).document).toEqual({
        title: "merhaba",
        views: 3,
        plain: "p"
      });
    });

    it("should leave a translated property nested in an object as a map when localizing", async () => {
      const nested = {
        title: {type: "string", options: {translate: true}},
        meta: {
          type: "object",
          properties: {label: {type: "string", options: {translate: true}}}
        }
      };
      const document = {
        title: {en_US: "hello", tr_TR: "merhaba"},
        meta: {label: {en_US: "label", tr_TR: "etiket"}}
      };

      expect((await shaped(nested, document, [], TR)).document).toEqual({
        title: "merhaba",
        meta: {label: {en_US: "label", tr_TR: "etiket"}}
      });
    });

    it("should return every locale when neither the requested nor the default one exists", async () => {
      const other = {title: {fr_FR: "bonjour"}, views: {fr_FR: 1}, plain: "p"};

      expect((await shaped(properties, other, [], TR)).document).toEqual(expected(other));
    });
  });

  it("should expose the primary key under its own name", async () => {
    const bucket = await store.createBucket({title: {type: "string"}});
    const key = await store.insert(bucket, {title: "t"});

    const document = await store.read(bucket, key);

    expect(document).toHaveProperty(store.keyField);
    const foreignKeys = Object.values(ENGINE_KEY_FIELDS).filter(name => name != store.keyField);
    foreignKeys.forEach(name => expect(document).not.toHaveProperty(name));
  });
});
