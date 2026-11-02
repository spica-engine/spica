import {Test, TestingModule} from "@nestjs/testing";
import {provideRepository} from "@spica-server/data";
import {contractSuite, DatabaseService} from "@spica-server/database-testing";
import {
  BUCKET_DATA_REPOSITORY,
  BUCKET_REPOSITORY,
  BUCKET_SCHEMA_MANAGER
} from "@spica-server/interface-bucket";
import {BUCKET_QUERY} from "@spica-server/interface-bucket-common";
import {ID_TYPES, IdType, IdTypes, PG_POOL, RESULT_SHAPER} from "@spica-server/interface-data";
import pg from "pg";
import {fetchRowSet, insertDocument} from "../shape/database.js";
import {describeAll} from "../shape/support.js";

const preferences = {
  language: {available: {en_US: "English", tr_TR: "Turkish"}, default: "en_US"}
};

const TR = {best: "tr_TR", fallback: "en_US"};

type Fixture = Record<string, any>;

contractSuite("result shape", engine => {
  const mongo = engine.name == "mongodb";
  let module: TestingModule;
  let idType: IdType;
  let created: Record<string, any>;
  let labels: Map<string, string>;
  let counter = 0;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [engine.module()],
      providers: [
        provideRepository(BUCKET_REPOSITORY),
        provideRepository(BUCKET_SCHEMA_MANAGER),
        ...(mongo ? [provideRepository(BUCKET_DATA_REPOSITORY)] : [])
      ]
    }).compile();
    await module.init();
    idType = module.get<IdTypes>(ID_TYPES).unscoped();
  }, 120_000);

  afterAll(() => module.close());

  beforeEach(() => {
    created = {};
    labels = new Map();
  });

  async function createBucket(properties: Fixture) {
    const names = Object.keys(properties);
    const bucket = await module.get(BUCKET_SCHEMA_MANAGER).create(
      {
        title: `shape ${++counter}`,
        description: "",
        icon: "",
        primary: mongo ? names[0] : "id",
        readOnly: false,
        history: false,
        order: 0,
        acl: {read: "true==true", write: "true==true"},
        properties: mongo
          ? properties
          : {id: {type: "uuid", options: {generated: true}}, ...properties}
      } as any,
      () => {}
    );
    created[String(bucket._id)] = bucket;
    return bucket;
  }

  async function insert(bucket: any, label: string, document: Fixture) {
    const key = idType.generate();
    labels.set(String(key), label);
    if (mongo) {
      await module
        .get(DatabaseService)
        .collection(`bucket_${bucket._id}`)
        .insertOne({
          _id: key,
          ...document
        } as any);
    } else {
      await insertDocument(module.get<pg.Pool>(PG_POOL), describeAll(created)(String(bucket._id)), {
        id: key,
        ...document
      });
    }
    return key;
  }

  async function read(bucket: any, key: unknown, resolve: string[] = [], locale?: typeof TR) {
    const result = mongo
      ? (
          await module.get(BUCKET_QUERY).find(
            bucket,
            {
              relationPaths: resolve.map(path => [path, "_id"]),
              localize: Boolean(locale),
              language: locale?.best
            },
            {resolveSchema: id => created[String(id)], preferences: async () => preferences as any}
          )
        ).result[0]
      : await module
          .get(RESULT_SHAPER)
          .shape(
            {kind: "bucket", bucketId: String(bucket._id)},
            await fetchRowSet(
              module.get<pg.Pool>(PG_POOL),
              describeAll(created),
              String(bucket._id),
              key,
              resolve
            ),
            {locale}
          );
    return normalize(JSON.parse(JSON.stringify(result)));
  }

  function normalize(value: any): any {
    if (Array.isArray(value)) {
      return value.map(normalize);
    }
    if (value && typeof value == "object") {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([name]) => name != "_id" && name != "id")
          .map(([name, inner]) => [name, normalize(inner)])
      );
    }
    return typeof value == "string" && labels.has(value) ? `<${labels.get(value)}>` : value;
  }

  async function shaped(properties: Fixture, document: Fixture, resolve?: string[], locale?: any) {
    const bucket = await createBucket(properties);
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
      const target = await createBucket({
        name: {type: "string"},
        tags: {type: "array", items: {type: "string"}}
      });
      const first = await insert(target, "first", {name: "first", tags: ["x"]});
      const second = await insert(target, "second", {name: "second", tags: []});
      const owner = await createBucket({
        title: {type: "string"},
        one: {type: "relation", bucketId: String(target._id), relationType: "onetoone"},
        many: {type: "relation", bucketId: String(target._id), relationType: "onetomany"}
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

    it("should return every locale when neither the requested nor the default one exists", async () => {
      const other = {title: {fr_FR: "bonjour"}, views: {fr_FR: 1}, plain: "p"};

      expect((await shaped(properties, other, [], TR)).document).toEqual(expected(other));
    });
  });

  it("should expose the primary key under its own name", async () => {
    const bucket = await createBucket({title: {type: "string"}});
    const key = await insert(bucket, "document", {title: "t"});
    const raw = mongo
      ? await module.get(DatabaseService).collection(`bucket_${bucket._id}`).findOne({})
      : await module
          .get(RESULT_SHAPER)
          .shape(
            {kind: "bucket", bucketId: String(bucket._id)},
            await fetchRowSet(
              module.get<pg.Pool>(PG_POOL),
              describeAll(created),
              String(bucket._id),
              key
            )
          );

    expect(raw).toHaveProperty(mongo ? "_id" : "id");
    expect(raw).not.toHaveProperty(mongo ? "id" : "_id");
  });
});
