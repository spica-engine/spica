import {mongoBucketSchema} from "@spica-server/data-mongodb";
import {originalValidator, SCHEMA_ID, validatorFor, violations} from "./bucket-schema.helper";

describe("MongoDB bucket schema", () => {
  const id = "507f1f77bcf86cd799439011";
  const other = "507f1f77bcf86cd799439012";

  const bucket = (extra: object = {}, properties: object = {}) => ({
    title: "New Bucket",
    description: "Describe your new bucket",
    primary: "title",
    properties: {title: {type: "string"}, ...properties},
    ...extra
  });

  const corpus: [string, object][] = [
    ["a minimal bucket", bucket()],
    ["an explicit id", bucket({_id: id})],
    ["a bad id", bucket({_id: "nope"})],
    ["a uuid as the id", bucket({_id: "0198a7e0-7b1c-7d2e-9f3a-4b5c6d7e8f90"})],
    ["no title", {description: "Describe your new bucket", properties: {a: {type: "string"}}}],
    ["a short title", bucket({title: "abc"})],
    ["a long description", bucket({description: "x".repeat(251)})],
    ["an unknown root key", bucket({primaryKey: {field: "title", type: "text", generated: false}})],
    ["acl", bucket({acl: {read: "true==true", write: "true==true"}})],
    ["acl without write", bucket({acl: {read: "true==true"}})],
    ["history and readOnly", bucket({history: true, readOnly: false, order: 2, category: "x"})],
    [
      "document settings",
      bucket({documentSettings: {countLimit: 5, limitExceedBehaviour: "prevent"}})
    ],
    [
      "bad document settings",
      bucket({documentSettings: {countLimit: 0, limitExceedBehaviour: "stop"}})
    ],
    ["required fields", bucket({required: ["title"]})],
    ["duplicate required fields", bucket({required: ["title", "title"]})],
    ["an _id property", bucket({}, {_id: {type: "string"}})],
    ["a bad property name", bucket({}, {"1a": {type: "string"}})],
    ["a uuid property type", bucket({}, {u: {type: "uuid"}})],
    ["an integer property type", bucket({}, {n: {type: "integer"}})],
    [
      "every mongodb type",
      bucket(
        {},
        {
          a: {type: "array", items: {type: "string"}},
          b: {type: "multiselect", items: {type: "string", enum: ["x"]}},
          c: {type: "boolean"},
          d: {type: "number"},
          e: {type: "object", properties: {f: {type: "string"}}},
          g: {type: "storage"},
          h: {type: "richtext"},
          i: {type: "date"},
          j: {type: "textarea"},
          k: {type: "color"},
          l: {type: "location", locationType: "Point"},
          m: {type: "json"},
          n: {type: "hash"},
          o: {type: "encrypted"}
        }
      )
    ],
    [
      "a onetoone relation",
      bucket({}, {r: {type: "relation", bucketId: other, relationType: "onetoone"}})
    ],
    [
      "a onetomany relation",
      bucket(
        {},
        {r: {type: "relation", bucketId: other, relationType: "onetomany", dependent: true}}
      )
    ],
    [
      "a relation to a uuid bucket",
      bucket(
        {},
        {
          r: {
            type: "relation",
            bucketId: "0198a7e0-7b1c-7d2e-9f3a-4b5c6d7e8f90",
            relationType: "onetoone"
          }
        }
      )
    ],
    ["a relation without a target", bucket({}, {r: {type: "relation", relationType: "onetoone"}})],
    [
      "a relation with a bad type",
      bucket({}, {r: {type: "relation", bucketId: other, relationType: "many"}})
    ],
    ["a bad location type", bucket({}, {l: {type: "location", locationType: "Polygon"}})],
    [
      "translate and history options",
      bucket({}, {t: {type: "string", options: {translate: true, history: true}}})
    ],
    ["a generated option", bucket({}, {t: {type: "string", options: {generated: true}}})],
    ["an unknown option", bucket({}, {t: {type: "string", options: {x: 1}}})],
    [
      "nested arrays",
      bucket({}, {m: {type: "array", items: {type: "array", items: {type: "number"}}}})
    ],
    [
      "a translated object",
      bucket(
        {},
        {t: {type: "object", options: {translate: true}, properties: {a: {type: "string"}}}}
      )
    ],
    [
      "property keywords",
      bucket(
        {},
        {
          s: {
            type: "string",
            title: "S",
            description: "d",
            minLength: 1,
            maxLength: 5,
            pattern: "^a",
            default: "a",
            enum: ["a"],
            acl: "true==true",
            readOnly: true,
            examples: ["a"]
          }
        }
      )
    ],
    ["a bad pattern", bucket({}, {s: {type: "string", pattern: "("}})],
    ["an unknown type", bucket({}, {s: {type: "money"}})],
    [
      "indexes",
      bucket({
        indexes: [
          {definition: {title: 1}, options: {unique: true}},
          {definition: {title: "text"}},
          {definition: {"a.b": -1}, options: {expireAfterSeconds: 5}}
        ]
      })
    ],
    ["an empty index", bucket({indexes: [{definition: {}}]})],
    ["an index without a definition", bucket({indexes: [{options: {}}]})],
    ["an index with an unknown key", bucket({indexes: [{definition: {a: 1}, name: "x"}]})]
  ];

  let composed: ReturnType<typeof validatorFor>;
  let original: ReturnType<typeof originalValidator>;

  beforeAll(() => {
    composed = validatorFor(mongoBucketSchema);
    original = originalValidator();
  });

  it.each(corpus)("should judge %s like the schema it replaces", async (_, definition) => {
    const expected = await violations(
      original,
      "http://spica.internal/bucket/original",
      definition
    );
    const actual = await violations(composed, SCHEMA_ID, definition);

    expect(actual).toEqual(expected);
  });

  it("should accept and reject at least some of the corpus", async () => {
    const results = await Promise.all(
      corpus.map(
        async ([, definition]) => (await violations(composed, SCHEMA_ID, definition)).length
      )
    );

    expect(results.some(count => count == 0)).toBe(true);
    expect(results.some(count => count > 0)).toBe(true);
  });

  it("should reject the options that only PostgreSQL has", async () => {
    expect(
      await violations(
        composed,
        SCHEMA_ID,
        bucket({}, {t: {type: "string", options: {generated: true}}})
      )
    ).not.toEqual([]);
  });
});
