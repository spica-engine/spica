import {encrypt} from "@spica-server/core-encryption";
import {postgresWriter, uuid} from "./support.js";

describe("PostgreSQL bucket write: insert", () => {
  const {createBucket, insert, rows, rowsOf} = postgresWriter();

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

  describe("child tables", () => {
    it("should write the items of a list in order, one row each", async () => {
      const bucket = await createBucket({tags: {type: "array", items: {type: "string"}}});

      const saved = await insert(bucket, {tags: ["b", "a", "b"]});

      expect(
        (await rowsOf(bucket, "tags")).map(row => [row._parent, row._position, row._value])
      ).toEqual([
        [saved.id, 0, "b"],
        [saved.id, 1, "a"],
        [saved.id, 2, "b"]
      ]);
    });

    it("should write the fields of the items of a list of objects into columns", async () => {
      const bucket = await createBucket({
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              sku: {type: "string"},
              size: {type: "object", properties: {w: {type: "number"}}}
            }
          }
        }
      });

      await insert(bucket, {lines: [{sku: "a", size: {w: 1}}, {sku: "b"}]});

      expect(
        (await rowsOf(bucket, "lines")).map(row => [row._position, row.sku, row.size__w])
      ).toEqual([
        [0, "a", 1],
        [1, "b", null]
      ]);
    });

    it("should write one row for each language of a translated property", async () => {
      const bucket = await createBucket({label: {type: "string", options: {translate: true}}});

      await insert(bucket, {label: {en_US: "hello", tr_TR: "merhaba", de_DE: null}});

      expect(
        (await rowsOf(bucket, "label", "_locale")).map(row => [row._locale, row._value])
      ).toEqual([
        ["en_US", "hello"],
        ["tr_TR", "merhaba"]
      ]);
    });

    it("should write the links of a one to many relation in order", async () => {
      const authors = await createBucket({name: {type: "string"}});
      const ann = (await insert(authors, {name: "ann"})).id;
      const bob = (await insert(authors, {name: "bob"})).id;
      const posts = await createBucket({
        editors: {type: "relation", bucketId: String(authors._id), relationType: "onetomany"}
      });

      const saved = await insert(posts, {editors: [bob, ann]});

      expect(saved.editors).toEqual([bob, ann]);
      expect((await rowsOf(posts, "editors")).map(row => [row._position, row._target])).toEqual([
        [0, bob],
        [1, ann]
      ]);
    });

    it("should write a list that is inside an object", async () => {
      const bucket = await createBucket({
        meta: {type: "object", properties: {tags: {type: "array", items: {type: "string"}}}}
      });

      const saved = await insert(bucket, {meta: {tags: ["x", "y"]}});

      expect(saved.meta.tags).toEqual(["x", "y"]);
      expect(await rowsOf(bucket, "meta.tags")).toHaveLength(2);
    });

    it("should write nothing for an empty or missing list", async () => {
      const bucket = await createBucket({
        tags: {type: "array", items: {type: "string"}},
        more: {type: "array", items: {type: "string"}}
      });

      const saved = await insert(bucket, {tags: []});

      expect(saved.tags).toEqual([]);
      expect(await rowsOf(bucket, "tags")).toEqual([]);
      expect(await rowsOf(bucket, "more")).toEqual([]);
    });

    it("should write a list that is too long for one statement", async () => {
      const bucket = await createBucket({scores: {type: "array", items: {type: "integer"}}});
      const scores = Array.from({length: 40_000}, (_, index) => index);

      const saved = await insert(bucket, {scores});

      expect(saved.scores).toHaveLength(40_000);
      expect(saved.scores.slice(0, 3)).toEqual([0, 1, 2]);
    });

    it("should keep the encrypted items of a list as text", async () => {
      const bucket = await createBucket({codes: {type: "array", items: {type: "encrypted"}}});
      const code = encrypt("1234", "encryption-secret", "hash-secret");

      const saved = await insert(bucket, {codes: [code]});

      expect(saved.codes).toEqual([
        {encrypted: code.encrypted, iv: code.iv, authTag: code.authTag}
      ]);
      expect(JSON.parse((await rowsOf(bucket, "codes"))[0]._value).encrypted).toBe(code.encrypted);
    });

    it("should write nothing when a row of a child table is refused", async () => {
      const authors = await createBucket({name: {type: "string"}});
      const posts = await createBucket({
        title: {type: "string"},
        tags: {type: "array", items: {type: "string"}},
        editors: {type: "relation", bucketId: String(authors._id), relationType: "onetomany"}
      });

      await expect(
        insert(posts, {title: "p", tags: ["a"], editors: [uuid(404)]})
      ).rejects.toThrow();

      expect(await rows(posts)).toEqual([]);
      expect(await rowsOf(posts, "tags")).toEqual([]);
    });
  });
});
