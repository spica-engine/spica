import {compile} from "@spica-server/bucket-services";
import {bindIdTypes} from "@spica-server/data";
import {Bucket, BucketPreferences} from "@spica-server/interface-bucket";
import {IdTypes} from "@spica-server/interface-data";

describe("compile", () => {
  const preferences = {
    language: {default: "en", available: {en: "English"}}
  } as unknown as BucketPreferences;

  const bucketOf = (primary: string, properties: Bucket["properties"]) =>
    ({primary, properties, acl: {read: "true==true", write: "true==true"}}) as Bucket;

  afterEach(() => bindIdTypes(undefined as unknown as IdTypes));

  describe("on an engine that keys documents by a fixed field", () => {
    beforeEach(() => bindIdTypes({keyField: () => "ref"} as unknown as IdTypes));

    it("should add an objectid property named by the key", () => {
      const schema = compile(bucketOf("title", {title: {type: "string"}}), preferences);
      expect(schema.properties.ref).toEqual({type: "string", format: "objectid"});
    });
  });

  describe("on an engine that keys documents by the primary field", () => {
    beforeEach(() =>
      bindIdTypes({keyField: (bucket: {primary?: string}) => bucket.primary} as unknown as IdTypes)
    );

    it("should not add a property when the primary field is the key", () => {
      const schema = compile(bucketOf("id", {id: {type: "uuid" as any}}), preferences);
      expect(Object.keys(schema.properties)).toEqual(["id"]);
    });

    describe("relations", () => {
      const relations = (options?: Parameters<typeof compile>[2]) =>
        compile(
          bucketOf("id", {
            id: {type: "uuid" as any},
            owner: {type: "relation", bucketId: "b", relationType: "onetoone"} as any,
            editors: {type: "relation", bucketId: "b", relationType: "onetomany"} as any
          }),
          preferences,
          options
        ).properties as Record<string, any>;

      it("should validate relation values as object ids by default", () => {
        const properties = relations();

        expect(properties.owner).toMatchObject({type: "string", format: "objectid-string"});
        expect(properties.editors.items).toEqual({type: "string", format: "objectid-string"});
      });

      it("should accept a string or an integer key when relations hold the primary key", () => {
        const properties = relations({relationsByPrimaryKey: true});

        expect(properties.owner.type).toEqual(["string", "integer"]);
        expect(properties.owner.format).toBeUndefined();
        expect(properties.editors.items).toEqual({type: ["string", "integer"]});
      });

      it("should let a one-to-one relation hold null as well when nullable", () => {
        const properties = relations({relationsByPrimaryKey: true, nullable: true});

        expect(properties.owner.type).toEqual(["string", "integer", "null"]);
        expect(properties.editors.type).toBe("array");
      });
    });

    it("should compile a uuid property to a uuid string", () => {
      const schema = compile(bucketOf("id", {id: {type: "uuid" as any}}), preferences);
      expect(schema.properties.id).toEqual({type: "string", format: "uuid"});
    });

    it("should compile a bigint property to a string of digits", () => {
      const schema = compile(bucketOf("id", {id: {type: "bigint" as any}}), preferences);
      const {type, pattern} = schema.properties.id as {type: string; pattern: string};
      expect(type).toBe("string");
      expect(new RegExp(pattern).test("-9007199254740993")).toBe(true);
      expect(new RegExp(pattern).test("12ab")).toBe(false);
    });

    it("should keep an integer property as an integer", () => {
      const schema = compile(bucketOf("id", {id: {type: "integer"}}), preferences);
      expect(schema.properties.id).toEqual({type: "integer"});
    });
  });

  describe("with nullable properties", () => {
    beforeEach(() =>
      bindIdTypes({keyField: (bucket: {primary?: string}) => bucket.primary} as unknown as IdTypes)
    );

    const nullableOf = (properties: Bucket["properties"], extra: Partial<Bucket> = {}) =>
      compile(
        {...bucketOf("id", {id: {type: "uuid" as any}, ...properties}), ...extra},
        preferences,
        {
          nullable: true
        }
      ).properties as Record<string, any>;

    it("should not change anything unless asked to", () => {
      const schema = compile(
        bucketOf("id", {id: {type: "uuid" as any}, title: {type: "string"}}),
        preferences
      );
      expect(schema.properties.title).toEqual({type: "string"});
    });

    it("should let optional scalar properties hold null and keep their format", () => {
      const properties = nullableOf({
        title: {type: "string"},
        qty: {type: "number"},
        count: {type: "integer"},
        active: {type: "boolean"},
        due: {type: "date" as any},
        ref: {type: "uuid" as any},
        big: {type: "bigint" as any},
        secret: {type: "hash" as any}
      });

      expect(properties.title.type).toEqual(["string", "null"]);
      expect(properties.qty.type).toEqual(["number", "null"]);
      expect(properties.count.type).toEqual(["integer", "null"]);
      expect(properties.active.type).toEqual(["boolean", "null"]);
      expect(properties.due).toEqual({type: ["string", "null"], format: "date-time"});
      expect(properties.ref).toEqual({type: ["string", "null"], format: "uuid"});
      expect(properties.big.type).toEqual(["string", "null"]);
      expect(properties.big.pattern).toBe("^-?\\d+$");
      expect(properties.secret).toEqual({type: ["string", "null"], format: "hash"});
    });

    it("should add null to the values of an enum", () => {
      const properties = nullableOf({status: {type: "string", enum: ["draft", "live"]}});
      expect(properties.status).toEqual({type: ["string", "null"], enum: ["draft", "live", null]});
    });

    it("should keep required properties and the key strict", () => {
      const properties = nullableOf({title: {type: "string"}, note: {type: "string"}}, {
        required: ["title"]
      } as Partial<Bucket>);

      expect(properties.title.type).toBe("string");
      expect(properties.note.type).toEqual(["string", "null"]);
      expect(properties.id).toEqual({type: "string", format: "uuid"});
    });

    it("should keep translated properties strict", () => {
      const properties = nullableOf({title: {type: "string", options: {translate: true}}});
      expect(properties.title.properties.en.type).toBe("string");
    });

    it("should let optional children of an object hold null, but not the object itself", () => {
      const properties = nullableOf({
        meta: {
          type: "object",
          required: ["kind"],
          properties: {kind: {type: "string"}, note: {type: "string"}}
        } as any
      });

      expect(properties.meta.type).toBe("object");
      expect(properties.meta.properties.kind.type).toBe("string");
      expect(properties.meta.properties.note.type).toEqual(["string", "null"]);
    });

    it("should keep arrays with items and their items strict, but not optional children of item objects", () => {
      const properties = nullableOf({
        tags: {type: "array", items: {type: "string"}} as any,
        lines: {
          type: "array",
          items: {type: "object", properties: {sku: {type: "string"}}}
        } as any
      });

      expect(properties.tags.type).toBe("array");
      expect(properties.tags.items.type).toBe("string");
      expect(properties.lines.type).toBe("array");
      expect(properties.lines.items.type).toBe("object");
      expect(properties.lines.items.properties.sku.type).toEqual(["string", "null"]);
    });

    it("should let a one-to-one relation hold null, but not a one-to-many relation", () => {
      const properties = nullableOf({
        owner: {type: "relation", bucketId: "b", relationType: "onetoone"} as any,
        editors: {type: "relation", bucketId: "b", relationType: "onetomany"} as any
      });

      expect(properties.owner.type).toEqual(["string", "null"]);
      expect(properties.editors.type).toBe("array");
    });

    it("should let properties kept in a jsonb column hold null", () => {
      const properties = nullableOf({
        payload: {type: "json" as any},
        free: {type: "object"},
        loose: {type: "array"},
        place: {type: "location" as any, locationType: "Point"} as any
      });

      expect(properties.payload.type).toEqual(["object", "null"]);
      expect(properties.free.type).toEqual(["object", "null"]);
      expect(properties.loose.type).toEqual(["array", "null"]);
      expect(properties.place.type).toEqual(["object", "null"]);
      expect(properties.place.required).toEqual(["coordinates"]);
    });

    it("should hold a single null when the same bucket is compiled twice", () => {
      const bucket = bucketOf("id", {id: {type: "uuid" as any}, title: {type: "string"}});
      compile(bucket, preferences, {nullable: true});
      const schema = compile(bucket, preferences, {nullable: true});

      expect((schema.properties.title as any).type).toEqual(["string", "null"]);
    });
  });
});
