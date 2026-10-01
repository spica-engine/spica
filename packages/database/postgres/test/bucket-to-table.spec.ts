import {describe, expect, it} from "@jest/globals";
import {Bucket} from "@spica-server/interface-bucket";
import {compileCreateTable} from "@spica-server/database-postgres";
import {bucketToTable, UnknownPropertyTypeError} from "@spica-server/database-postgres";

const BUCKET_ID = "67a1f0000000000000000001";
const TARGET_ID = "67b3000000000000000000b3";

function bucket(properties: Record<string, any>): Bucket {
  return {
    _id: BUCKET_ID as any,
    title: "Test",
    description: "",
    primary: "title",
    acl: {read: "true==true", write: "true==true"},
    properties
  } as Bucket;
}

const kindOf = (props: Record<string, any>, key: string) =>
  bucketToTable(bucket(props)).columns.find(c => c.name === key)?.kind;

describe("bucketToTable", () => {
  describe("the table's identity", () => {
    it("the table name stays the same as the Mongo collection name", () => {
      expect(bucketToTable(bucket({title: {type: "string"}})).collection).toBe(
        `bucket_${BUCKET_ID}`
      );
    });

    it("_id is NOT in the column list (an implicit primary key)", () => {
      const spec = bucketToTable(bucket({title: {type: "string"}}));
      expect(spec.columns.map(c => c.name)).not.toContain("_id");
    });

    it("is deterministic: the same schema produces the same TableSpec", () => {
      const schema = bucket({
        title: {type: "string"},
        views: {type: "number"},
        tags: {type: "array", items: {type: "string"}}
      });
      expect(bucketToTable(schema)).toEqual(bucketToTable(schema));
    });

    it("the column order follows the property order", () => {
      const spec = bucketToTable(
        bucket({z: {type: "string"}, a: {type: "number"}, m: {type: "boolean"}})
      );
      expect(spec.columns.map(c => c.name)).toEqual(["z", "a", "m"]);
    });
  });

  describe("the mapping of the 16 property types", () => {
    it.each([
      ["string", "text"],
      ["textarea", "text"],
      ["richtext", "text"],
      ["color", "text"],
      ["hash", "text"],
      ["storage", "text"],
      ["number", "number"],
      ["boolean", "boolean"],
      ["date", "timestamp"],
      ["object", "json"],
      ["json", "json"],
      ["multiselect", "textArray"],
      ["location", "location"],
      /**
       * `encrypted` → `json`, NOT `bytes`: an encrypted value is an **object** shaped
       * `{encrypted, iv, authTag}` (`BaseEncryptedData`), not raw bytes. The first mapping said `bytes` and
       * the codec blew up trying `Buffer.from(object)`.
       */
      ["encrypted", "json"]
    ])("%s → %s", (type, expected) => {
      expect(kindOf({f: {type}}, "f")).toBe(expected);
    });

    it("raises loudly for an unknown type", () => {
      expect(() => bucketToTable(bucket({f: {type: "kuantum"}}))).toThrow(UnknownPropertyTypeError);
    });
  });

  describe("array fields", () => {
    it("an array of scalar text → textArray (indexable with GIN)", () => {
      expect(kindOf({tags: {type: "array", items: {type: "string"}}}, "tags")).toBe("textArray");
    });

    it("an array of numbers → numberArray", () => {
      expect(kindOf({scores: {type: "array", items: {type: "number"}}}, "scores")).toBe(
        "numberArray"
      );
    });

    it("an array of objects → json", () => {
      expect(
        kindOf(
          {rows: {type: "array", items: {type: "object", properties: {a: {type: "string"}}}}},
          "rows"
        )
      ).toBe("json");
    });

    it("an untyped array → json", () => {
      expect(kindOf({any: {type: "array"}}, "any")).toBe("json");
    });

    it("an array of dates is deliberately json (we do not multiply native types)", () => {
      expect(kindOf({dates: {type: "array", items: {type: "date"}}}, "dates")).toBe("json");
    });

    it("when items is given as an array the first element's type is used", () => {
      expect(kindOf({tags: {type: "array", items: [{type: "string"}]}}, "tags")).toBe("textArray");
    });
  });

  describe("multiple languages", () => {
    it("options.translate overrides the base type → json", () => {
      const spec = bucketToTable(bucket({title: {type: "string", options: {translate: true}}}));
      const column = spec.columns.find(c => c.name === "title");
      expect(column.kind).toBe("json");
      expect(column.translated).toBe(true);
    });

    it("a field that is not translated carries no translated marker", () => {
      const spec = bucketToTable(bucket({title: {type: "string"}}));
      expect(spec.columns.find(c => c.name === "title").translated).toBeUndefined();
    });

    it("a numeric field also becomes json when it is translatable", () => {
      expect(kindOf({amount: {type: "number", options: {translate: true}}}, "amount")).toBe("json");
    });
  });

  describe("relation", () => {
    it("onetoone → a reference column plus the target table", () => {
      const spec = bucketToTable(
        bucket({author: {type: "relation", relationType: "onetoone", bucketId: TARGET_ID}})
      );
      const column = spec.columns.find(c => c.name === "author");
      expect(column.kind).toBe("reference");
      expect(column.target).toBe(`bucket_${TARGET_ID}`);
      expect(column.cascadeOnDelete).toBe(false);
    });

    it("onetoone + dependent → cascade", () => {
      const spec = bucketToTable(
        bucket({
          author: {type: "relation", relationType: "onetoone", bucketId: TARGET_ID, dependent: true}
        })
      );
      expect(spec.columns.find(c => c.name === "author").cascadeOnDelete).toBe(true);
    });

    /**
     * `onetomany` is an **id array column**; no junction table is produced. The rationale is in
     * `bucketToTable`: a junction table cannot carry the difference between "the field was never written" and
     * "the field was emptied", and two tests rest on that difference.
     */
    it("onetomany produces an id array column, not a junction table", () => {
      const spec = bucketToTable(
        bucket({authors: {type: "relation", relationType: "onetomany", bucketId: TARGET_ID}})
      );
      expect(spec.columns).toEqual([
        {
          name: "authors",
          kind: "textArray",
          target: `bucket_${TARGET_ID}`,
          cascadeOnDelete: false
        }
      ]);
    });

    it("onetomany + dependent → the cascade intent is carried on the column", () => {
      const spec = bucketToTable(
        bucket({
          authors: {
            type: "relation",
            relationType: "onetomany",
            bucketId: TARGET_ID,
            dependent: true
          }
        })
      );
      expect(spec.columns[0].cascadeOnDelete).toBe(true);
    });

    /** No FK is written on an array column: a foreign key only goes on `reference` columns. */
    it("no FK is written on a onetomany column", () => {
      const spec = bucketToTable(
        bucket({authors: {type: "relation", relationType: "onetomany", bucketId: TARGET_ID}})
      );
      expect(compileCreateTable(spec).some(s => s.sql.includes("FOREIGN KEY"))).toBe(false);
    });

    it("several onetomany fields produce several columns", () => {
      const spec = bucketToTable(
        bucket({
          a: {type: "relation", relationType: "onetomany", bucketId: TARGET_ID},
          b: {type: "relation", relationType: "onetomany", bucketId: TARGET_ID}
        })
      );
      expect(spec.columns.map(c => c.name)).toEqual(["a", "b"]);
      expect(spec.columns.every(c => c.kind === "textArray")).toBe(true);
    });
  });

  describe("empty and boundary cases", () => {
    it("a bucket with no properties produces a table with the implicit _id only", () => {
      const spec = bucketToTable(bucket({}));
      expect(spec.columns).toEqual([]);
    });

    it("does not raise when properties is undefined", () => {
      const schema = bucket({});
      delete (schema as any).properties;
      expect(bucketToTable(schema).columns).toEqual([]);
    });
  });
});
