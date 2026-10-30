import {describeBucket, BucketSchemaError} from "@spica-server/data-postgresql";

describe("bucket metadata", () => {
  const bucketId = "0198a7e0-7b1c-7d2e-9f3a-4b5c6d7e8f90";

  const bucket = (extra: object = {}) =>
    ({
      title: "b",
      primary: "id",
      acl: {read: "", write: ""},
      properties: {id: {type: "uuid", options: {generated: true}}, title: {type: "string"}},
      ...extra
    }) as any;

  describe("primary key", () => {
    it("should be the primary property, with the type of that property", () => {
      const metadata = describeBucket(bucketId, bucket());

      expect(metadata.main.name).toBe(`bucket_${bucketId}`);
      expect(metadata.primaryKey).toEqual({
        field: "id",
        type: "uuid",
        generated: true,
        column: "id"
      });
    });

    it.each([
      ["uuid", "uuid"],
      ["integer", "integer"],
      ["bigint", "bigint"],
      ["string", "text"]
    ])("should be a %s key on a %s property", (propertyType, keyType) => {
      const metadata = describeBucket(
        bucketId,
        bucket({primary: "key", properties: {key: {type: propertyType}}})
      );

      expect(metadata.primaryKey).toMatchObject({field: "key", type: keyType, generated: false});
      expect(metadata.columnOf(["key"])).toMatchObject({type: keyType, notNull: true});
    });

    it("should be generated when the property says so", () => {
      const metadata = describeBucket(
        bucketId,
        bucket({primary: "n", properties: {n: {type: "bigint", options: {generated: true}}}})
      );

      expect(metadata.primaryKey.generated).toBe(true);
    });

    it("should be refused without a primary property or with one that cannot hold a key", () => {
      expect(() => describeBucket(bucketId, bucket({primary: undefined}))).toThrow(BucketSchemaError);
      expect(() => describeBucket(bucketId, bucket({primary: "nope"}))).toThrow(BucketSchemaError);
      expect(() =>
        describeBucket(bucketId, bucket({primary: "n", properties: {n: {type: "number"}}}))
      ).toThrow('primary must name a uuid, integer, bigint or string property, but "n" does not.');
    });
  });

  describe("describeBucket", () => {
    it("should map scalar property types to column types", () => {
      const properties = {
        id: {type: "uuid"},
        s: {type: "string"},
        t: {type: "textarea"},
        r: {type: "richtext"},
        c: {type: "color"},
        f: {type: "storage"},
        h: {type: "hash"},
        e: {type: "encrypted"},
        n: {type: "number"},
        b: {type: "boolean"},
        d: {type: "date"},
        j: {type: "json"},
        u: {type: "uuid"},
        i: {type: "integer"},
        g: {type: "bigint"}
      };

      const metadata = describeBucket(bucketId, bucket({properties}));

      expect(metadata.main.columns.map(column => [column.name, column.type])).toEqual([
        ["id", "uuid"],
        ["s", "text"],
        ["t", "text"],
        ["r", "text"],
        ["c", "text"],
        ["f", "text"],
        ["h", "text"],
        ["e", "text"],
        ["n", "double precision"],
        ["b", "boolean"],
        ["d", "timestamptz"],
        ["j", "jsonb"],
        ["u", "uuid"],
        ["i", "integer"],
        ["g", "bigint"]
      ]);
    });

    it("should make required properties and the key not null", () => {
      const metadata = describeBucket(bucketId, bucket({required: ["title"]}));

      expect(metadata.columnOf(["id"]).notNull).toBe(true);
      expect(metadata.columnOf(["title"]).notNull).toBe(true);
      expect(describeBucket(bucketId, bucket()).columnOf(["title"]).notNull).toBe(false);
    });

    it("should carry enum values", () => {
      const metadata = describeBucket(
        bucketId,
        bucket({
          properties: {id: {type: "uuid"}, kind: {type: "string", enum: ["a", "b"]}}
        })
      );

      expect(metadata.columnOf(["kind"]).enum).toEqual(["a", "b"]);
      expect(metadata.columnOf(["id"]).enum).toBeUndefined();
    });

    it("should find no column for an unknown property", () => {
      expect(describeBucket(bucketId, bucket()).columnOf(["nope"])).toBeUndefined();
    });

    it("should reject properties that need structures this part does not build yet", () => {
      const properties = {
        id: {type: "uuid"},
        tags: {type: "array", items: {type: "string"}},
        name: {type: "string", options: {translate: true}}
      };

      expect(() => describeBucket(bucketId, bucket({properties}))).toThrow(
        "Properties are not supported on PostgreSQL yet: tags (array), name (translated string)."
      );
    });
  });
});
