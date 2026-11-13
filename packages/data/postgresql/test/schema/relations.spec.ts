import {relationTargets, withoutRelationsTo} from "@spica-server/data-postgresql";

describe("relations", () => {
  const relation = (bucketId: string, relationType = "onetoone") => ({
    type: "relation",
    bucketId,
    relationType
  });

  const bucket = (extra: object = {}): any => ({
    title: "b",
    primary: "title",
    acl: {read: "", write: ""},
    properties: {},
    ...extra
  });

  describe("relationTargets", () => {
    it("should find the buckets related from any depth once", () => {
      const properties: any = {
        a: relation("x"),
        b: relation("x", "onetomany"),
        o: {type: "object", properties: {c: relation("y")}},
        rows: {type: "array", items: {type: "object", properties: {d: relation("z")}}},
        s: {type: "string"}
      };

      expect(relationTargets(properties)).toEqual(["x", "y", "z"]);
    });

    it("should find nothing in a bucket without properties", () => {
      expect(relationTargets(undefined)).toEqual([]);
    });
  });

  describe("withoutRelationsTo", () => {
    it("should return null when nothing points at the bucket", () => {
      expect(withoutRelationsTo(bucket({properties: {a: relation("x")}}), "other")).toBeNull();
    });

    it("should remove the relation properties, their required entries and their indexes", () => {
      const result = withoutRelationsTo(
        bucket({
          properties: {a: relation("x"), b: relation("y"), t: {type: "string"}},
          required: ["a", "b", "t"],
          indexes: [
            {definition: {a: 1}, options: {}},
            {definition: {t: 1, a: -1}, options: {}},
            {definition: {b: 1}, options: {}}
          ]
        }),
        "x"
      );

      expect(Object.keys(result.properties)).toEqual(["b", "t"]);
      expect(result.required).toEqual(["b", "t"]);
      expect(result.indexes).toEqual([{definition: {b: 1}, options: {}}]);
    });

    it("should remove relations inside objects and array items and keep the rest", () => {
      const result = withoutRelationsTo(
        bucket({
          properties: {
            o: {
              type: "object",
              required: ["gone", "kept"],
              properties: {gone: relation("x"), kept: {type: "string"}}
            },
            rows: {
              type: "array",
              items: {type: "object", properties: {gone: relation("x"), qty: {type: "number"}}}
            },
            untouched: {type: "object", properties: {n: {type: "number"}}}
          },
          indexes: [{definition: {"o.gone": 1}, options: {}}]
        }),
        "x"
      );

      expect(result.properties.o).toEqual({
        type: "object",
        required: ["kept"],
        properties: {kept: {type: "string"}}
      });
      expect(result.properties.rows).toEqual({
        type: "array",
        items: {type: "object", properties: {qty: {type: "number"}}}
      });
      expect(result.properties.untouched).toEqual({
        type: "object",
        properties: {n: {type: "number"}}
      });
      expect(result.indexes).toEqual([]);
    });

    it("should not change the bucket it was given", () => {
      const original = bucket({properties: {a: relation("x"), t: {type: "string"}}});
      const copy = structuredClone(original);

      withoutRelationsTo(original, "x");

      expect(original).toEqual(copy);
    });
  });
});
