import {Test, TestingModule} from "@nestjs/testing";
import {PostgresBucketWriteFacade} from "@spica-server/data-postgresql";
import {encrypt} from "@spica-server/core-encryption";
import {provideRepository} from "@spica-server/data";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {BUCKET_REPOSITORY, BUCKET_SCHEMA_MANAGER} from "@spica-server/interface-bucket";
import {BUCKET_WRITE} from "@spica-server/interface-bucket-common";
import {PG_POOL} from "@spica-server/interface-data";
import pg from "pg";
import {mainTableName} from "@spica-server/data-postgresql";

const uuid = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, "0")}`;

describe("PostgreSQL bucket write: insert", () => {
  let module: TestingModule;
  let writes: PostgresBucketWriteFacade;
  let pool: pg.Pool;
  const known = new Map<string, any>();
  let counter = 0;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.postgres()],
      providers: [provideRepository(BUCKET_REPOSITORY), provideRepository(BUCKET_SCHEMA_MANAGER)]
    }).compile();
    await module.init();
    writes = module.get(BUCKET_WRITE);
    pool = module.get(PG_POOL);
  }, 120_000);

  afterAll(() => module.close());

  async function createBucket(properties: object, extra: object = {}) {
    const bucket = await module.get(BUCKET_SCHEMA_MANAGER).create(
      {
        title: `insert ${++counter}`,
        description: "",
        primary: "id",
        acl: {read: "true==true", write: "true==true"},
        properties: {id: {type: "uuid", options: {generated: true}}, ...properties},
        ...extra
      } as any,
      () => {}
    );
    known.set(String(bucket._id), bucket);
    return bucket;
  }

  const insert = (bucket: any, document: object) =>
    writes.insert(
      bucket,
      document as any,
      {},
      {
        resolveSchema: id => known.get(String(id)),
        deleteOne: async () => {}
      }
    );

  const rows = async (bucket: any) =>
    (await pool.query(`SELECT * FROM "${mainTableName(String(bucket._id))}" ORDER BY 1`)).rows;

  describe("keys", () => {
    it("should generate a uuid", async () => {
      const bucket = await createBucket({title: {type: "string"}});

      const saved = await insert(bucket, {title: "a"});

      expect(saved.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/);
    });

    it("should keep a given uuid", async () => {
      const bucket = await createBucket({title: {type: "string"}});

      expect((await insert(bucket, {id: uuid(5), title: "a"})).id).toBe(uuid(5));
    });

    it("should generate integer keys in turn", async () => {
      const bucket = await createBucket(
        {title: {type: "string"}},
        {properties: {id: {type: "integer", options: {generated: true}}, title: {type: "string"}}}
      );

      const first = await insert(bucket, {title: "a"});
      const second = await insert(bucket, {title: "b"});

      expect([first.id, second.id]).toEqual([1, 2]);
    });

    it("should continue after a given integer key instead of colliding with it", async () => {
      const bucket = await createBucket(
        {},
        {properties: {id: {type: "integer", options: {generated: true}}, title: {type: "string"}}}
      );

      await insert(bucket, {id: 10, title: "given"});
      const generated = await insert(bucket, {title: "generated"});

      expect(generated.id).toBe(11);
    });

    it("should not move the sequence back when a smaller integer key is given", async () => {
      const bucket = await createBucket(
        {},
        {properties: {id: {type: "integer", options: {generated: true}}, title: {type: "string"}}}
      );
      await insert(bucket, {id: 10, title: "a"});

      await insert(bucket, {id: 3, title: "b"});

      expect((await insert(bucket, {title: "c"})).id).toBe(11);
    });

    it("should answer a bigint key as a string", async () => {
      const bucket = await createBucket(
        {},
        {properties: {id: {type: "bigint", options: {generated: true}}, title: {type: "string"}}}
      );

      const saved = await insert(bucket, {id: "9007199254740993", title: "a"});

      expect(saved.id).toBe("9007199254740993");
      expect((await insert(bucket, {title: "b"})).id).toBe("9007199254740994");
    });

    it("should keep a given string key", async () => {
      const bucket = await createBucket(
        {},
        {properties: {id: {type: "string"}, title: {type: "string"}}}
      );

      expect((await insert(bucket, {id: "abc", title: "a"})).id).toBe("abc");
    });

    it("should refuse a document without a key that is not generated", async () => {
      const bucket = await createBucket(
        {},
        {properties: {id: {type: "string"}, title: {type: "string"}}}
      );

      await expect(insert(bucket, {title: "a"})).rejects.toMatchObject({
        status: 400,
        message: "The primary key .id is required."
      });
      expect(await rows(bucket)).toEqual([]);
    });
  });

  describe("columns", () => {
    it("should store an object in prefixed columns and leave the others empty", async () => {
      const bucket = await createBucket({
        title: {type: "string"},
        address: {type: "object", properties: {city: {type: "string"}, zip: {type: "string"}}}
      });

      await insert(bucket, {title: "a", address: {city: "Rome"}});

      expect(await rows(bucket)).toEqual([
        expect.objectContaining({title: "a", address__city: "Rome", address__zip: null})
      ]);
    });

    it("should store a json value as json, a bigint as a number and a location as a point", async () => {
      const bucket = await createBucket({
        meta: {type: "json"},
        big: {type: "bigint"},
        place: {type: "location", locationType: "Point"}
      });

      const saved = await insert(bucket, {
        meta: {a: [1, "x"]},
        big: "9007199254740993",
        place: {type: "Point", coordinates: [12.5, 41.9]}
      });

      expect(saved).toMatchObject({
        meta: {a: [1, "x"]},
        big: "9007199254740993",
        place: {type: "Point", coordinates: [12.5, 41.9]}
      });
      expect(await rows(bucket)).toEqual([
        expect.objectContaining({meta: {a: [1, "x"]}, place: {x: 12.5, y: 41.9}})
      ]);
    });

    it("should store a date as a timestamp", async () => {
      const bucket = await createBucket({born: {type: "date"}});
      const born = new Date("2020-01-02T03:04:05.678Z");

      await insert(bucket, {born});

      expect((await rows(bucket))[0].born).toEqual(born);
    });
  });

  describe("encrypted values", () => {
    const sealed = (value: string) => encrypt(value, "encryption-secret", "hash-secret");

    it("should store the ciphertext as text and the hash in the column beside it", async () => {
      const bucket = await createBucket({secret: {type: "encrypted"}});
      const value = sealed("hello");

      await insert(bucket, {secret: value});

      const [row] = await rows(bucket);
      expect(JSON.parse(row.secret)).toEqual({
        encrypted: value.encrypted,
        iv: value.iv,
        authTag: value.authTag
      });
      expect(row.secret__hash).toBe(value.hash);
    });

    it("should store an encrypted property of an object in prefixed columns", async () => {
      const bucket = await createBucket({
        profile: {type: "object", properties: {pin: {type: "encrypted"}}}
      });
      const value = sealed("1234");

      await insert(bucket, {profile: {pin: value}});

      const [row] = await rows(bucket);
      expect(JSON.parse(row.profile__pin).encrypted).toBe(value.encrypted);
      expect(row.profile__pin__hash).toBe(value.hash);
    });

    it("should refuse a value that was not encrypted and write nothing", async () => {
      const bucket = await createBucket({secret: {type: "encrypted"}});

      await expect(insert(bucket, {secret: "plain"})).rejects.toMatchObject({
        status: 400,
        message: "The property .secret must be an encrypted value."
      });
      expect(await rows(bucket)).toEqual([]);
    });
  });

  describe("values that are not written yet", () => {
    it.each([
      ["a list", {tags: {type: "array", items: {type: "string"}}}, {tags: ["a"]}, ".tags"],
      [
        "a translation",
        {label: {type: "string", options: {translate: true}}},
        {label: {en_US: "a"}},
        ".label"
      ]
    ])("should refuse %s and write nothing", async (_name, properties, document, path) => {
      const bucket = await createBucket({title: {type: "string"}, ...properties});

      await expect(insert(bucket, {title: "a", ...document})).rejects.toMatchObject({
        status: 400,
        message: `The property ${path} cannot be written to PostgreSQL yet.`
      });
      expect(await rows(bucket)).toEqual([]);
    });

    it("should accept an empty list", async () => {
      const bucket = await createBucket({tags: {type: "array", items: {type: "string"}}});

      const saved = await insert(bucket, {tags: []});

      expect(saved.tags).toEqual([]);
    });
  });
});
