import {composeBucketSchema} from "@spica-server/bucket-common";
import {BUCKET_SCHEMA_HOOKS} from "@spica-server/interface-bucket";

describe("composeBucketSchema", () => {
  const hooks = Object.fromEntries(BUCKET_SCHEMA_HOOKS.map(hook => [hook, {type: hook}]));

  const base = {
    $id: "base",
    required: ["title"],
    definitions: {schema: {type: "object"}},
    properties: {title: {type: "string"}},
    additionalProperties: false
  };

  it("should add the hooks to the definitions and keep the base", () => {
    const composed = composeBucketSchema(base, {definitions: hooks});

    expect(composed.$id).toBe("base");
    expect(composed.additionalProperties).toBe(false);
    expect(Object.keys(composed.definitions)).toEqual(["schema", ...BUCKET_SCHEMA_HOOKS]);
  });

  it("should add root properties, required entries and rules", () => {
    const composed = composeBucketSchema(
      {...base, allOf: [{minProperties: 1}]},
      {
        definitions: hooks,
        properties: {extra: {type: "number"}},
        required: ["extra"],
        allOf: [{custom: true}]
      }
    );

    expect(Object.keys(composed.properties)).toEqual(["title", "extra"]);
    expect(composed.required).toEqual(["title", "extra"]);
    expect(composed.allOf).toEqual([{minProperties: 1}, {custom: true}]);
  });

  it("should not change the base", () => {
    composeBucketSchema(base, {definitions: hooks, required: ["x"], properties: {x: {}}});

    expect(base.required).toEqual(["title"]);
    expect(Object.keys(base.properties)).toEqual(["title"]);
    expect(Object.keys(base.definitions)).toEqual(["schema"]);
  });

  it("should name the hooks an extension forgets", () => {
    const {indexes, itemSchema, ...partial} = hooks;

    expect(() => composeBucketSchema(base, {definitions: partial})).toThrow(
      "The bucket schema extension does not define: itemSchema, indexes."
    );
  });

  it("should not let an extension redefine the base", () => {
    expect(() =>
      composeBucketSchema(base, {definitions: {...hooks, schema: {type: "string"}}})
    ).toThrow("The bucket schema extension redefines: schema.");
  });
});
