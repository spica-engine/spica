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
      expect(() => describeBucket(bucketId, bucket({primary: undefined}))).toThrow(
        BucketSchemaError
      );
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
        owner: {type: "relation", bucketId: "x", relationType: "onetoone"},
        where: {type: "location"},
        name: {type: "string", options: {translate: true}},
        matrix: {type: "array", items: {type: "array", items: {type: "number"}}}
      };

      expect(() => describeBucket(bucketId, bucket({properties}))).toThrow(
        "Properties are not supported on PostgreSQL yet: owner (relation), where (location), name (translated string), matrix (array of nested array)."
      );
    });

    describe("objects", () => {
      const address = {
        type: "object",
        required: ["city"],
        properties: {
          city: {type: "string"},
          geo: {
            type: "object",
            required: ["lat"],
            properties: {lat: {type: "number"}, lng: {type: "number"}}
          }
        }
      };

      it("should flatten an object into prefixed columns of the main table", () => {
        const metadata = describeBucket(
          bucketId,
          bucket({properties: {id: {type: "uuid"}, address}})
        );

        expect(metadata.children).toEqual([]);
        expect(
          metadata.main.columns.map(column => [column.name, column.type, column.path.join(".")])
        ).toEqual([
          ["id", "uuid", "id"],
          ["address__city", "text", "address.city"],
          ["address__geo__lat", "double precision", "address.geo.lat"],
          ["address__geo__lng", "double precision", "address.geo.lng"]
        ]);
        expect(metadata.columnOf(["address", "geo", "lat"]).name).toBe("address__geo__lat");
      });

      it("should only require the children of an object that is itself required", () => {
        const optional = describeBucket(
          bucketId,
          bucket({properties: {id: {type: "uuid"}, address}})
        );
        const required = describeBucket(
          bucketId,
          bucket({properties: {id: {type: "uuid"}, address}, required: ["address"]})
        );

        expect(optional.main.columns.map(column => column.notNull)).toEqual([
          true,
          false,
          false,
          false
        ]);
        expect(required.main.columns.map(column => column.notNull)).toEqual([
          true,
          true,
          false,
          false
        ]);
      });

      it("should keep an object without declared properties as a jsonb column", () => {
        const metadata = describeBucket(
          bucketId,
          bucket({properties: {id: {type: "uuid"}, extra: {type: "object"}}})
        );

        expect(metadata.columnOf(["extra"])).toMatchObject({name: "extra", type: "jsonb"});
      });

      it("should reject two properties that flatten to the same column", () => {
        expect(() =>
          describeBucket(
            bucketId,
            bucket({
              properties: {
                id: {type: "uuid"},
                a__b: {type: "string"},
                a: {type: "object", properties: {b: {type: "string"}}}
              }
            })
          )
        ).toThrow(/both map to "a__b"/);
      });
    });

    describe("arrays", () => {
      it("should give an array of scalars a child table keyed by the parent and the position", () => {
        const metadata = describeBucket(
          bucketId,
          bucket({
            properties: {
              id: {type: "uuid"},
              tags: {type: "array", items: {type: "string"}},
              scores: {type: "multiselect", items: {type: "string", enum: ["a", "b"]}}
            }
          })
        );

        expect(metadata.children.map(table => table.name)).toEqual([
          `bucket_${bucketId}__tags`,
          `bucket_${bucketId}__scores`
        ]);
        const [tags, scores] = metadata.children;
        expect(tags.keyColumns).toEqual(["_parent", "_position"]);
        expect(tags.columns.map(column => [column.name, column.type, column.notNull])).toEqual([
          ["_parent", "uuid", true],
          ["_position", "integer", true],
          ["_value", "text", true]
        ]);
        expect(tags.parent.column).toBe("_parent");
        expect(scores.columns[2].enum).toEqual(["a", "b"]);
        expect(metadata.columnOf(["tags"])).toMatchObject({table: tags.name, name: "_value"});
        expect(metadata.columnOf(["tags", "[]"])).toMatchObject({table: tags.name, name: "_value"});
      });

      it("should type the parent column after the primary key", () => {
        const metadata = describeBucket(
          bucketId,
          bucket({
            primary: "sku",
            properties: {sku: {type: "bigint"}, tags: {type: "array", items: {type: "string"}}}
          })
        );

        expect(metadata.children[0].columns[0]).toMatchObject({name: "_parent", type: "bigint"});
      });

      it("should flatten the object items of an array into the child table", () => {
        const metadata = describeBucket(
          bucketId,
          bucket({
            properties: {
              id: {type: "uuid"},
              rows: {
                type: "array",
                items: {
                  type: "object",
                  required: ["sku"],
                  properties: {
                    sku: {type: "string"},
                    qty: {type: "number"},
                    box: {type: "object", properties: {w: {type: "number"}}}
                  }
                }
              }
            }
          })
        );

        const [rows] = metadata.children;
        expect(rows.columns.map(column => [column.name, column.notNull])).toEqual([
          ["_parent", true],
          ["_position", true],
          ["sku", true],
          ["qty", false],
          ["box__w", false]
        ]);
        expect(metadata.columnOf(["rows", "[]", "box", "w"])).toMatchObject({
          table: rows.name,
          name: "box__w"
        });
      });

      it("should give an array inside an object its own child table", () => {
        const metadata = describeBucket(
          bucketId,
          bucket({
            properties: {
              id: {type: "uuid"},
              contact: {
                type: "object",
                properties: {phones: {type: "array", items: {type: "string"}}}
              }
            }
          })
        );

        expect(metadata.children.map(table => table.name)).toEqual([
          `bucket_${bucketId}__contact__phones`
        ]);
      });

      it("should keep an array without items as a jsonb column", () => {
        const metadata = describeBucket(
          bucketId,
          bucket({properties: {id: {type: "uuid"}, loose: {type: "array"}}})
        );

        expect(metadata.children).toEqual([]);
        expect(metadata.columnOf(["loose"])).toMatchObject({type: "jsonb"});
      });

      it("should shorten the name of a child table that would be too long", () => {
        const long = "a".repeat(40);
        const metadata = describeBucket(
          bucketId,
          bucket({
            properties: {id: {type: "uuid"}, [long]: {type: "array", items: {type: "string"}}}
          })
        );

        expect(Buffer.byteLength(metadata.children[0].name)).toBe(63);
      });

      it("should index an array of scalars on its child table and refuse mixed tables", () => {
        const properties = {
          id: {type: "uuid"},
          title: {type: "string"},
          tags: {type: "array", items: {type: "string"}}
        };

        const metadata = describeBucket(
          bucketId,
          bucket({properties, indexes: [{definition: {tags: 1}, options: {}}]})
        );
        expect(metadata.children[0].indexes).toEqual([
          {
            table: metadata.children[0].name,
            name: `${metadata.children[0].name}__value_ix`,
            unique: false,
            columns: [{name: "_value", order: "asc"}]
          }
        ]);

        expect(() =>
          describeBucket(
            bucketId,
            bucket({properties, indexes: [{definition: {title: 1, tags: 1}, options: {}}]})
          )
        ).toThrow("spans more than one table");
      });
    });
  });
});
