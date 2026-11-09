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

  describe("on an engine that keys documents by _id", () => {
    beforeEach(() => bindIdTypes({keyField: () => "_id"} as unknown as IdTypes));

    it("should add an objectid _id property", () => {
      const schema = compile(bucketOf("title", {title: {type: "string"}}), preferences);
      expect(schema.properties._id).toEqual({type: "string", format: "objectid"});
    });
  });

  describe("on an engine that keys documents by the primary field", () => {
    beforeEach(() =>
      bindIdTypes({keyField: (bucket: {primary?: string}) => bucket.primary} as unknown as IdTypes)
    );

    it("should not add an _id property", () => {
      const schema = compile(bucketOf("id", {id: {type: "uuid" as any}}), preferences);
      expect(schema.properties._id).toBeUndefined();
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
});
