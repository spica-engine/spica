import {Validator, hasSystemKey, withSystemKey} from "@spica-server/core-schema";
import {IdTypes} from "@spica-server/interface-data";

const PLACEHOLDER = "$systemKey";

const schema = {
  $id: "http://spica.internal/test/thing",
  type: "object",
  required: [PLACEHOLDER, "name"],
  additionalProperties: false,
  properties: {
    [PLACEHOLDER]: {type: "string"},
    name: {type: "string"},
    nested: {
      type: "array",
      items: {type: "object", properties: {[PLACEHOLDER]: {type: "string"}}}
    }
  }
};

const idTypes = (key: string) => ({systemKeyField: () => key}) as unknown as IdTypes;

describe("system key in schemas", () => {
  describe("withSystemKey", () => {
    it.each(["key", "id"])("should name the key %s in properties and required", key => {
      const renamed = withSystemKey(schema, key);

      expect(Object.keys(renamed.properties)).toEqual([key, "name", "nested"]);
      expect(renamed.required).toEqual([key, "name"]);
    });

    it("should rename the key at any depth", () => {
      const renamed = withSystemKey(schema, "id");

      expect(Object.keys(renamed.properties.nested.items.properties)).toEqual(["id"]);
    });

    it("should keep the order and content of everything else", () => {
      const renamed = withSystemKey(schema, "id");

      expect(renamed.properties.id).toEqual({type: "string"});
      expect(renamed.properties.name).toEqual({type: "string"});
      expect(renamed.$id).toBe(schema.$id);
    });

    it("should not change the schema it renames", () => {
      withSystemKey(schema, "id");

      expect(Object.keys(schema.properties)).toEqual([PLACEHOLDER, "name", "nested"]);
    });

    it("should return a schema without the placeholder as it is", () => {
      const plain = {type: "object", properties: {name: {type: "string"}}};

      expect(withSystemKey(plain, "id")).toBe(plain);
    });
  });

  describe("hasSystemKey", () => {
    it("should find the placeholder as a property name and as a list item", () => {
      expect(hasSystemKey({properties: {[PLACEHOLDER]: {}}})).toBe(true);
      expect(hasSystemKey({required: [PLACEHOLDER]})).toBe(true);
    });

    it("should not find it in a schema without it", () => {
      expect(hasSystemKey({properties: {name: {}}, required: ["name"]})).toBe(false);
      expect(hasSystemKey(null)).toBe(false);
    });
  });

  describe("Validator", () => {
    it.each(["key", "id"])("should validate a body keyed by %s", async key => {
      const validator = new Validator({}, {}, idTypes(key));
      validator.registerSchema(schema);

      await expect(
        validator.validate(schema.$id, {[key]: "a", name: "n"})
      ).resolves.toBeUndefined();
    });

    it("should reject the other engine's key", async () => {
      const validator = new Validator({}, {}, idTypes("id"));
      validator.registerSchema(schema);

      await expect(
        validator.validate(schema.$id, {key: "a", id: "a", name: "n"})
      ).rejects.toBeDefined();
    });

    it("should require the key it names", async () => {
      const validator = new Validator({}, {}, idTypes("id"));
      validator.registerSchema(schema);

      await expect(validator.validate(schema.$id, {name: "n"})).rejects.toBeDefined();
    });

    it("should name the key in schemas given as options", async () => {
      const validator = new Validator({schemas: [schema]}, {}, idTypes("id"));

      await expect(validator.validate(schema.$id, {id: "a", name: "n"})).resolves.toBeUndefined();
    });

    it("should name the key in a schema validated by value", async () => {
      const validator = new Validator({}, {}, idTypes("id"));

      await expect(validator.validate(schema, {id: "a", name: "n"})).resolves.toBeUndefined();
    });

    it("should fail loudly when a schema names the key and there are no id types", () => {
      const validator = new Validator();

      expect(() => validator.registerSchema(schema)).toThrow(
        "A schema names the system record key, but no id types are available."
      );
    });

    it("should still take schemas that do not name the key without id types", async () => {
      const validator = new Validator();
      const plain = {$id: "http://spica.internal/test/plain", type: "string"};
      validator.registerSchema(plain);

      await expect(validator.validate(plain.$id, "a")).resolves.toBeUndefined();
    });
  });
});
