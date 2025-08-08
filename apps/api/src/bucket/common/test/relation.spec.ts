import {
  findRelations,
  getUpdateParams,
  isArray,
  isObject,
  isDesiredRelation,
  createRelationMap,
  getRelationResolvedBucketSchema
} from "..";
import {deepCopy} from "../../../../../../libs/core/patch";
import {RelationType} from "../../../../../../libs/interface/bucket/common";

describe("Relation", () => {
  it("should check whether schema is object or not", () => {
    const schema = {
      type: "object",
      properties: {
        test: ""
      }
    };
    expect(isObject(schema)).toBe(true);

    schema.type = "string";
    expect(isObject(schema)).toBe(false);
  });

  it("should check whether schema is correct relation or not", () => {
    const schema = {
      type: "relation",
      bucketId: "id1"
    };
    expect(isDesiredRelation(schema, "id1")).toEqual(true);

    expect(isDesiredRelation(schema, "id2")).toEqual(false);

    schema.type = "object";
    expect(isDesiredRelation(schema, "id1")).toEqual(false);
  });

  it("should check whether schema is array or not", () => {
    const schema = {type: "array", items: {type: "string"}};
    expect(isArray(schema)).toBe(true);

    schema.type = "string";
    expect(isArray(schema)).toBe(false);
  });

  it("should find relations", () => {
    const schema = {
      nested_relation: {
        type: "object",
        properties: {
          one_to_one: {type: "relation", bucketId: "id1", relationType: "onetoone"},
          one_to_many: {type: "relation", bucketId: "id1", relationType: "onetomany"},
          not_here: {type: "relation", bucketId: "id2"}
        }
      },
      root_relation: {type: "relation", bucketId: "id1", relationType: "onetoone"},
      not_relation: {type: "string"}
    };
    const targets = findRelations(schema, "id1", "", new Map());

    expect(targets).toEqual(
      new Map([
        ["nested_relation.one_to_one", "onetoone"],
        ["nested_relation.one_to_many", "onetomany"],
        ["root_relation", "onetoone"]
      ])
    );
  });

  it("should get update operation params for one to one relation", () => {
    const updateParams = getUpdateParams("test_key", RelationType.One, "document_id");
    expect(updateParams).toEqual({
      filter: {test_key: "document_id"},
      update: {$unset: {test_key: ""}}
    });
  });

  it("should get update operation params for one to many relation", () => {
    const updateParams = getUpdateParams("test_key", RelationType.Many, "document_id");
    expect(updateParams).toEqual({
      filter: {test_key: {$in: ["document_id"]}},
      update: {$pull: {test_key: "document_id"}}
    });
  });

  describe("relationMap and resolving relation of bucket schema", () => {
    let mainSchema;

    let userSchema;

    let walletSchema;

    let schemas;

    let resolve;

    beforeEach(() => {
      mainSchema = {
        properties: {
          user: {
            type: "relation",
            relationType: "onetoone",
            bucketId: "user_bucket_id"
          },
          userWithMeta: {
            type: "object",
            properties: {
              user: {
                type: "relation",
                relationType: "onetoone",
                bucketId: "user_bucket_id"
              },
              score: {
                type: "number"
              }
            }
          }
        }
      };

      userSchema = {
        _id: "user_bucket_id",
        properties: {
          name: {
            type: "string"
          },
          wallet: {
            type: "relation",
            relationType: "onetomany",
            bucketId: "wallet_bucket_id"
          }
        }
      };

      walletSchema = {
        _id: "wallet_bucket_id",
        properties: {
          brand: {
            type: "string"
          }
        }
      };

      schemas = [userSchema, walletSchema];

      resolve = id => {
        return Promise.resolve(schemas.find(s => s._id == id) as any);
      };
    });

    describe("relationMap", () => {
      it("should create relation if name of the user is requested", async () => {
        const mainSchema = {
          properties: {
            user: {
              type: "relation",
              relationType: "onetoone",
              bucketId: "user_bucket_id"
            }
          }
        };

        const relationMap = await createRelationMap({
          paths: [["user", "name"]],
          properties: mainSchema.properties,
          resolve: resolve
        });

        expect(relationMap).toEqual([
          {
            path: "user",
            target: "user_bucket_id",
            type: RelationType.One,
            children: undefined,
            schema: userSchema
          }
        ]);
      });

      it("should not create relation map if property of user is not requested", async () => {
        const relationMap = await createRelationMap({
          paths: [["user"]],
          properties: mainSchema.properties,
          resolve: resolve
        });

        expect(relationMap).toEqual([]);
      });

      it("should create relation map if _id of user is requested", async () => {
        const relationMap = await createRelationMap({
          paths: [["user", "_id"]],
          properties: mainSchema.properties,
          resolve: resolve
        });

        expect(relationMap).toEqual([
          {
            path: "user",
            target: "user_bucket_id",
            type: RelationType.One,
            children: undefined,
            schema: userSchema
          }
        ]);
      });

      it("should create relation map if brand of the wallet of the user is requested", async () => {
        const relationMap = await createRelationMap({
          paths: [["user", "wallet", "brand"]],
          properties: mainSchema.properties,
          resolve: resolve
        });

        expect(relationMap).toEqual([
          {
            path: "user",
            target: "user_bucket_id",
            type: RelationType.One,
            schema: userSchema,
            children: [
              {
                path: "wallet",
                target: "wallet_bucket_id",
                type: RelationType.Many,
                children: undefined,
                schema: walletSchema
              }
            ]
          }
        ]);
      });

      it("should create relation map if name of the user is requested from userwithmeta object", async () => {
        const relationMap = await createRelationMap({
          paths: [["userWithMeta", "user", "name"]],
          properties: mainSchema.properties,
          resolve: resolve
        });

        expect(relationMap).toEqual([
          {
            path: "userWithMeta.user",
            target: "user_bucket_id",
            type: RelationType.One,
            children: undefined,
            schema: userSchema
          }
        ]);
      });

      it("should create relation map if multiple relations requested", async () => {
        const relationMap = await createRelationMap({
          paths: [
            ["userWithMeta", "user", "name"],
            ["user", "name"]
          ],
          properties: mainSchema.properties,
          resolve: resolve
        });

        expect(relationMap).toEqual([
          {
            path: "user",
            target: "user_bucket_id",
            type: RelationType.One,
            children: undefined,
            schema: userSchema
          },
          {
            path: "userWithMeta.user",
            target: "user_bucket_id",
            type: RelationType.One,
            children: undefined,
            schema: userSchema
          }
        ]);
      });
    });

    describe("getRelationResolvedBucketSchema", () => {
      it("should resolve user relation of main schema", async () => {
        const mainSchemaBefore = deepCopy(mainSchema);
        const expectedSchema = deepCopy(mainSchema);

        const relationResolvedMainSchema = await getRelationResolvedBucketSchema(
          mainSchema,
          [["user", "name"]],
          resolve
        );

        expectedSchema.properties.user = {
          // we are expecting this definition instead of relation
          type: "object",
          properties: {
            name: {type: "string"},
            wallet: {
              type: "relation",
              relationType: "onetomany",
              bucketId: "wallet_bucket_id"
            }
          }
        };
        expect(relationResolvedMainSchema).toEqual(expectedSchema);

        expect(mainSchema).toEqual(mainSchemaBefore);
      });

      it("should resolve user and wallets of user relation of main schema", async () => {
        const mainSchemaBefore = deepCopy(mainSchema);
        const expectedSchema = deepCopy(mainSchema);

        const relationResolvedMainSchema = await getRelationResolvedBucketSchema(
          mainSchema,
          [["user", "wallet", "brand"]],
          resolve
        );

        expectedSchema.properties.user = {
          type: "object",
          properties: {
            name: {type: "string"},
            wallet: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  brand: {
                    type: "string"
                  }
                }
              }
            }
          }
        };
        expect(relationResolvedMainSchema).toEqual(expectedSchema);

        expect(mainSchema).toEqual(mainSchemaBefore);
      });

      it("should resolve user inside of the userWithMeta object of main schema", async () => {
        const mainSchemaBefore = deepCopy(mainSchema);
        const expectedSchema = deepCopy(mainSchema);

        const relationResolvedMainSchema = await getRelationResolvedBucketSchema(
          mainSchema,
          [["userWithMeta", "user", "name"]],
          resolve
        );

        expectedSchema.properties.userWithMeta = {
          type: "object",
          properties: {
            user: {
              type: "object",
              properties: {
                name: {type: "string"},
                wallet: {
                  type: "relation",
                  relationType: "onetomany",
                  bucketId: "wallet_bucket_id"
                }
              }
            },
            score: {
              type: "number"
            }
          }
        };
        expect(relationResolvedMainSchema).toEqual(expectedSchema);

        expect(mainSchema).toEqual(mainSchemaBefore);
      });
    });
  });
});
