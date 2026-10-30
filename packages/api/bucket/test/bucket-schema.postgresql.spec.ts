import {postgresBucketSchema} from "@spica-server/data-postgresql";
import {SCHEMA_ID, validatorFor, violations} from "./bucket-schema.helper";

describe("PostgreSQL bucket schema", () => {
  const id = "0198a7e0-7b1c-7d2e-9f3a-4b5c6d7e8f90";
  const other = "0198a7e0-0000-7d2e-9f3a-4b5c6d7e8f91";

  const bucket = (extra: object = {}, properties: object = {}) => ({
    title: "New Bucket",
    description: "Describe your new bucket",
    primary: "id",
    properties: {
      id: {type: "uuid", options: {generated: true}},
      title: {type: "string"},
      ...properties
    },
    ...extra
  });

  let validator: ReturnType<typeof validatorFor>;

  beforeAll(() => {
    validator = validatorFor(postgresBucketSchema);
  });

  const check = (definition: object) => violations(validator, SCHEMA_ID, definition);

  const accepted = async (definition: object) => expect(await check(definition)).toEqual([]);
  const rejected = async (definition: object, message?: string) => {
    const problems = await check(definition);
    expect(problems.length).toBeGreaterThan(0);
    if (message) {
      expect(problems.join("\n")).toContain(message);
    }
  };

  it("should accept a bucket with a generated uuid key", () => accepted(bucket()));

  describe("shared settings", () => {
    it("should keep the common bucket settings", () =>
      accepted(
        bucket({
          acl: {read: "true==true", write: "true==true"},
          history: true,
          readOnly: false,
          order: 1,
          category: "x",
          icon: "y",
          required: ["title"],
          documentSettings: {countLimit: 5, limitExceedBehaviour: "remove"}
        })
      ));

    it("should still require a title, a description and properties", async () => {
      await rejected({
        description: "Describe your new bucket",
        primary: "id",
        properties: {id: {type: "uuid"}}
      });
      await rejected({title: "New Bucket", primary: "id", properties: {id: {type: "uuid"}}});
    });

    it("should reject unknown root settings, including primaryKey", () =>
      rejected(bucket({primaryKey: {field: "id", type: "uuid", generated: true}})));
  });

  describe("id", () => {
    it("should be a uuid", async () => {
      await accepted(bucket({_id: id}));
      await rejected(bucket({_id: "507f1f77bcf86cd799439011"}));
    });
  });

  describe("primary", () => {
    it("should be required", () => {
      const {primary, ...rest} = bucket();
      return rejected(rest);
    });

    it("should name a property", () =>
      rejected(
        bucket({primary: "missing"}),
        'primary must name a property, but "missing" is not one'
      ));

    it.each(["uuid", "integer", "bigint", "string"])("should accept a %s property", type =>
      accepted(bucket({primary: "key"}, {id: {type: "string"}, key: {type}}))
    );

    it.each([
      "number",
      "boolean",
      "date",
      "textarea",
      "object",
      "array",
      "relation",
      "location",
      "json"
    ])("should reject a %s property", type =>
      rejected(
        bucket({primary: "key"}, {id: {type: "string"}, key: {type}}),
        "the primary property"
      )
    );

    it("should reject a translated key", () =>
      rejected(
        bucket(
          {primary: "key"},
          {id: {type: "string"}, key: {type: "string", options: {translate: true}}}
        ),
        "cannot be translated"
      ));
  });

  describe("generated", () => {
    it.each(["uuid", "integer", "bigint"])("should be allowed on a %s key", type =>
      accepted(
        bucket({primary: "key"}, {id: {type: "string"}, key: {type, options: {generated: true}}})
      )
    );

    it("should be rejected on a string key", () =>
      rejected(
        bucket(
          {primary: "key"},
          {id: {type: "string"}, key: {type: "string", options: {generated: true}}}
        )
      ));

    it("should be rejected on a property that is not the key", () =>
      rejected(bucket({}, {other: {type: "uuid", options: {generated: true}}}), "can be"));

    it("should be rejected on a nested property", () =>
      rejected(
        bucket(
          {},
          {o: {type: "object", properties: {n: {type: "uuid", options: {generated: true}}}}}
        ),
        '"o.n" cannot be generated'
      ));

    it("should not be needed", () =>
      accepted(bucket({primary: "key"}, {id: {type: "string"}, key: {type: "uuid"}})));
  });

  describe("property types", () => {
    it("should add uuid, integer and bigint to the common types", () =>
      accepted(
        bucket(
          {},
          {
            a: {type: "uuid"},
            b: {type: "integer"},
            c: {type: "bigint"},
            d: {type: "location", locationType: "Point"}
          }
        )
      ));

    it("should reject an unknown type", () => rejected(bucket({}, {a: {type: "money"}})));
  });

  describe("property names", () => {
    it.each(["_id", "_parent", "_position", "_locale", "_value", "_source", "_target"])(
      "should reserve %s",
      name => rejected(bucket({}, {[name]: {type: "string"}}))
    );

    it("should reserve the names inside objects and array items too", async () => {
      await rejected(bucket({}, {o: {type: "object", properties: {_parent: {type: "string"}}}}));
      await rejected(
        bucket(
          {},
          {a: {type: "array", items: {type: "object", properties: {_value: {type: "string"}}}}}
        )
      );
    });

    it("should allow other names, including id", () =>
      accepted(bucket({}, {parent: {type: "string"}, _x: {type: "string"}})));
  });

  describe("relations", () => {
    it("should point at a uuid", async () => {
      await accepted(
        bucket({}, {r: {type: "relation", bucketId: other, relationType: "onetoone"}})
      );
      await rejected(
        bucket(
          {},
          {r: {type: "relation", bucketId: "507f1f77bcf86cd799439011", relationType: "onetoone"}}
        )
      );
    });
  });

  describe("translated properties", () => {
    it.each(["string", "textarea", "number", "boolean", "date", "json", "location", "uuid"])(
      "should allow %s",
      type => accepted(bucket({}, {t: {type, options: {translate: true}}}))
    );

    it.each(["object", "array", "multiselect", "relation"])("should reject %s", type =>
      rejected(bucket({}, {t: {type, options: {translate: true}}}))
    );
  });

  describe("array items", () => {
    const items = (schema: object) => bucket({}, {a: {type: "array", items: schema}});

    it("should allow scalars, objects and onetoone relations", async () => {
      await accepted(items({type: "string"}));
      await accepted(
        items({
          type: "object",
          properties: {a: {type: "string"}, g: {type: "object", properties: {x: {type: "number"}}}}
        })
      );
      await accepted(
        items({
          type: "object",
          properties: {r: {type: "relation", bucketId: other, relationType: "onetoone"}}
        })
      );
    });

    it("should reject nested arrays, also inside item objects", async () => {
      await rejected(items({type: "array", items: {type: "number"}}));
      await rejected(items({type: "multiselect", items: {type: "string"}}));
      await rejected(
        items({type: "object", properties: {inner: {type: "array", items: {type: "string"}}}})
      );
      await rejected(
        items({
          type: "object",
          properties: {
            g: {type: "object", properties: {inner: {type: "array", items: {type: "string"}}}}
          }
        })
      );
    });

    it("should reject translated items and onetomany relations, also inside item objects", async () => {
      await rejected(items({type: "string", options: {translate: true}}));
      await rejected(items({type: "relation", bucketId: other, relationType: "onetomany"}));
      await rejected(
        items({
          type: "object",
          properties: {r: {type: "relation", bucketId: other, relationType: "onetomany"}}
        })
      );
      await rejected(
        items({type: "object", properties: {t: {type: "string", options: {translate: true}}}})
      );
    });

    it("should reject an array of relations", async () => {
      await rejected(items({type: "relation", bucketId: other, relationType: "onetoone"}));
    });

    it("should allow arrays inside objects", () =>
      accepted(
        bucket(
          {},
          {o: {type: "object", properties: {tags: {type: "array", items: {type: "string"}}}}}
        )
      ));
  });

  describe("indexes", () => {
    const withIndex = (index: object, properties: object = {}) =>
      bucket({indexes: [index]}, properties);
    const place = {place: {type: "location"}};

    it("should allow ascending, descending and 2dsphere indexes with the stored options", async () => {
      await accepted(withIndex({definition: {title: 1}, options: {unique: true}}));
      await accepted(
        withIndex({definition: {title: -1, id: 1}, options: {sparse: true, background: true}})
      );
      await accepted(withIndex({definition: {place: "2dsphere"}}, place));
      await accepted(withIndex({definition: {place: "2dsphere"}, options: {unique: false}}, place));
    });

    it("should reject the mongodb index types and options", async () => {
      await rejected(withIndex({definition: {title: "text"}}));
      await rejected(withIndex({definition: {title: "hashed"}}));
      await rejected(withIndex({definition: {title: 1}, options: {expireAfterSeconds: 5}}));
      await rejected(withIndex({definition: {title: 1}, options: {unique: "yes"}}));
    });

    it("should reject an empty definition", () => rejected(withIndex({definition: {}})));

    it("should reject a 2dsphere index that mixes in other fields", () =>
      rejected(withIndex({definition: {place: "2dsphere", title: 1}}, place), "more than 1"));

    it("should reject a unique 2dsphere index", () =>
      rejected(withIndex({definition: {place: "2dsphere"}, options: {unique: true}}, place)));

    it("should reject the same index twice", () =>
      rejected(
        bucket({
          indexes: [
            {definition: {title: 1}, options: {}},
            {definition: {title: 1}, options: {}}
          ]
        })
      ));

    describe("fields", () => {
      const nested = {
        address: {
          type: "object",
          properties: {
            city: {type: "string"},
            geo: {type: "object", properties: {lat: {type: "number"}}}
          }
        },
        lines: {type: "array", items: {type: "object", properties: {sku: {type: "string"}}}},
        tags: {type: "array", items: {type: "string"}},
        friends: {type: "relation", bucketId: other, relationType: "onetomany"},
        name: {type: "string", options: {translate: true}},
        loose: {type: "array"}
      };

      it.each([
        "title",
        "address.city",
        "address.geo.lat",
        "lines.sku",
        "tags",
        "friends",
        "loose"
      ])("should index %s", field => accepted(withIndex({definition: {[field]: 1}}, nested)));

      it.each(["missing", "address.zip", "title.x", "constructor", "toString.x", "_id"])(
        "should reject %s, which is not a property",
        field =>
          rejected(
            withIndex({definition: {[field]: 1}}, nested),
            "which is not a property of the bucket"
          )
      );

      it.each(["address", "address.geo", "lines"])(
        "should reject %s, which only holds other fields",
        field =>
          rejected(
            withIndex({definition: {[field]: 1}}, nested),
            "which is not a property of the bucket"
          )
      );

      it.each(["name", "name.en_US"])("should reject the translated %s", field =>
        rejected(
          withIndex({definition: {[field]: 1}}, nested),
          "indexes on translated properties are not supported"
        )
      );

      it("should reject a translated property inside an object", () =>
        rejected(
          withIndex(
            {definition: {"seo.title": 1}},
            {
              seo: {
                type: "object",
                properties: {title: {type: "string", options: {translate: true}}}
              }
            }
          ),
          "translated"
        ));

      it("should only allow 2dsphere on a location", async () => {
        await rejected(withIndex({definition: {title: "2dsphere"}}), "which is not a location");
        await rejected(
          withIndex({definition: {place: 1}}, place),
          'can only index the location "place"'
        );
        await accepted(
          withIndex(
            {definition: {"lines.where": "2dsphere"}},
            {
              lines: {
                type: "array",
                items: {type: "object", properties: {where: {type: "location"}}}
              }
            }
          )
        );
      });

      it("should name every field that has a problem", async () => {
        const problems = await check(withIndex({definition: {nope: 1, title: "2dsphere"}}, nested));

        expect(problems.filter(problem => problem.includes("bucketIndexes"))).toHaveLength(0);
        expect(problems.join("\n")).toContain('"nope"');
        expect(problems.join("\n")).toContain('cannot use 2dsphere on "title"');
      });
    });
  });
});
