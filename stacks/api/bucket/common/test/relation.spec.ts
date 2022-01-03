import {
  findRelations,
  getUpdateParams,
  isArray,
  isObject,
  isDesiredRelation,
  RelationType
} from "@spica-server/bucket/common";
import {
  buildRelationAggregation,
  compareAndUpdateRelations,
  createPathFromRelationMap,
  createRelationMap,
  RelationMap
} from "../relation";

describe("Relation", () => {
  describe("schema", () => {
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
  });

  describe("relation detector", () => {
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

    it("should find relations which are inside of object array", () => {
      const schema = {
        nested_relation: {
          type: "object",
          properties: {
            arr: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  one_to_one: {type: "relation", bucketId: "id1", relationType: "onetoone"},
                  count: {type: "number"}
                }
              }
            },
            one_to_many: {type: "relation", bucketId: "id1", relationType: "onetomany"},
            not_here: {type: "relation", bucketId: "id2"}
          }
        },
        root_relation: {type: "relation", bucketId: "id1", relationType: "onetoone"},
        not_relation: {type: "string"}
      };

      const targets = findRelations(schema, "id1", "", new Map(), true);

      expect(targets).toEqual(
        new Map([
          ["nested_relation.[arr].one_to_one", "onetoone"],
          ["nested_relation.one_to_many", "onetomany"],
          ["root_relation", "onetoone"]
        ])
      );
    });
  });

  describe("relation builder", () => {
    it("should build relation aggregation", () => {
      const property = "info.age";
      const bucketId = "some_id";
      const type = RelationType.One;

      const aggregation = buildRelationAggregation(property, bucketId, type, undefined);

      expect(aggregation).toEqual([
        {
          $lookup: {
            from: "bucket_some_id",
            as: "info.age",
            let: {documentId: {$toObjectId: "$info.age"}},
            pipeline: [
              {
                $match: {$expr: {$eq: ["$_id", "$$documentId"]}}
              }
            ]
          }
        },
        {
          $unwind: {path: "$info.age", preserveNullAndEmptyArrays: true}
        }
      ]);
    });

    it("should build relation aggregation for nested array objects", () => {
      const property = "[foods].food_id";
      const bucketId = "some_id";
      const type = RelationType.One;

      const aggregation = buildRelationAggregation(property, bucketId, type, undefined);
      expect(aggregation).toEqual([
        {
          $unwind: {path: "$foods", preserveNullAndEmptyArrays: true}
        },
        {
          $lookup: {
            from: "bucket_some_id",
            as: "foods.food_id",
            let: {documentId: {$toObjectId: "$foods.food_id"}},
            pipeline: [
              {
                $match: {$expr: {$eq: ["$_id", "$$documentId"]}}
              }
            ]
          }
        },
        {
          $unwind: {path: "$foods.food_id", preserveNullAndEmptyArrays: true}
        },
        {
          $group: {
            _id: "$_id",
            _doc_: {$first: "$$ROOT"},
            foods: {$push: "$foods"}
          }
        },
        {$addFields: {"_doc_.foods": "$foods"}},
        {$replaceRoot: {newRoot: "$_doc_"}}
      ]);
    });
  });

  describe("update params", () => {
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
  });

  describe("createRelationMap", () => {
    const resolve = schemas => id => {
      return Promise.resolve(schemas.find(s => s._id == id) as any);
    };
    describe("basic", () => {
      it("should create relationMap for requested relations", async () => {
        const userBucketSchema = {
          _id: "user_bucket_id",
          properties: {
            name: {
              type: "string"
            }
          }
        };

        const cityBucketSchema = {
          _id: "city_bucket_id",
          properties: {
            title: {
              type: "string"
            }
          }
        };

        const resourceBucketSchema = {
          _id: "resource_bucket_id",
          properties: {
            type: {
              type: "string"
            }
          }
        };

        const schemas = [userBucketSchema, cityBucketSchema, resourceBucketSchema];

        const schema = {
          properties: {
            users: {
              type: "relation",
              relationType: "onetomany",
              bucketId: "user_bucket_id"
            },
            city: {
              type: "relation",
              relationType: "onetoone",
              bucketId: "city_bucket_id"
            },
            resources: {
              type: "relation",
              relationType: "onetoone",
              bucketId: "resource_bucket_id"
            }
          }
        };

        // we dont want to resolve resources
        const requestedRelations = [["users"], ["city", "_id"]];

        const relationMap = await createRelationMap({
          paths: requestedRelations,
          properties: schema.properties,
          resolve: resolve(schemas)
        });

        expect(relationMap).toEqual([
          {
            path: undefined,
            field: "users",
            target: "user_bucket_id",
            type: RelationType.Many,
            children: undefined
          },
          {
            path: undefined,
            field: "city",
            target: "city_bucket_id",
            type: RelationType.One,
            children: undefined
          }
        ]);
      });

      it("should create relationMap with child relations", async () => {
        const schema = {
          properties: {
            users: {
              type: "relation",
              relationType: "onetomany",
              bucketId: "user_bucket_id"
            }
          }
        };

        const userBucketSchema = {
          _id: "user_bucket_id",
          properties: {
            name: {
              type: "string"
            },
            addresses: {
              type: "relation",
              relationType: "onetomany",
              bucketId: "address_bucket_id"
            }
          }
        };

        const addressBucketSchema = {
          _id: "address_bucket_id",
          properties: {
            street: {
              type: "string"
            }
          }
        };

        const schemas = [userBucketSchema, addressBucketSchema];

        const requestedRelations = [["users", "addresses"]];

        const relationMap = await createRelationMap({
          paths: requestedRelations,
          properties: schema.properties,
          resolve: resolve(schemas)
        });

        expect(relationMap).toEqual([
          {
            path: undefined,
            field: "users",
            target: "user_bucket_id",
            type: RelationType.Many,
            children: [
              {
                path: undefined,
                field: "addresses",
                target: "address_bucket_id",
                type: RelationType.Many,
                children: undefined
              }
            ]
          }
        ]);
      });
    });

    describe("objects", () => {
      it("should create relationMap for object field relations", async () => {
        const userBucketSchema = {
          _id: "user_bucket_id",
          properties: {
            name: {
              type: "string"
            },
            addresses: {
              type: "relation",
              relationType: "onetomany",
              bucketId: "address_bucket_id"
            }
          }
        };

        const addressBucketSchema = {
          _id: "address_bucket_id",
          properties: {
            street: {
              type: "string"
            }
          }
        };

        const schemas = [userBucketSchema, addressBucketSchema];

        const schema = {
          properties: {
            info: {
              type: "object",
              properties: {
                confirmation: {
                  type: "object",
                  properties: {
                    users: {
                      type: "relation",
                      relationType: "onetomany",
                      bucketId: "user_bucket_id"
                    },
                    city: {
                      type: "relation",
                      relationType: "onetoone",
                      bucketId: "city_bucket_id"
                    },
                    confirmed: {
                      type: "boolean"
                    }
                  }
                }
              }
            }
          }
        };

        // we dont want to resolve city
        const requestedRelations = [["info", "confirmation", "users", "addresses"]];

        const relationMap = await createRelationMap({
          paths: requestedRelations,
          properties: schema.properties,
          resolve: resolve(schemas)
        });

        expect(relationMap).toEqual([
          {
            path: {
              field: "info",
              type: "object",
              children: {
                field: "confirmation",
                type: "object"
              }
            },
            field: "users",
            target: "user_bucket_id",
            type: RelationType.Many,
            children: [
              {
                path: undefined,
                field: "addresses",
                target: "address_bucket_id",
                type: RelationType.Many,
                children: undefined
              }
            ]
          }
        ]);
      });
    });

    describe("arrays", () => {
      it("should create relationMap for object field relations", async () => {
        const userBucketSchema = {
          _id: "user_bucket_id",
          properties: {
            name: {
              type: "string"
            },
            addresses: {
              type: "relation",
              relationType: "onetomany",
              bucketId: "address_bucket_id"
            }
          }
        };

        const addressBucketSchema = {
          _id: "address_bucket_id",
          properties: {
            street: {
              type: "string"
            }
          }
        };

        const schemas = [userBucketSchema, addressBucketSchema];

        const schema = {
          properties: {
            confirmations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  users: {
                    type: "relation",
                    relationType: "onetomany",
                    bucketId: "user_bucket_id"
                  },
                  city: {
                    type: "relation",
                    relationType: "onetoone",
                    bucketId: "city_bucket_id"
                  },
                  confirmed: {
                    type: "boolean"
                  }
                }
              }
            }
          }
        };

        // we dont want to resolve city
        const requestedRelations = [["confirmations", "users", "addresses"]];

        const relationMap = await createRelationMap({
          paths: requestedRelations,
          properties: schema.properties,
          resolve: resolve(schemas)
        });

        expect(relationMap).toEqual([
          {
            path: {
              field: "confirmations",
              type: "array"
            },
            field: "users",
            target: "user_bucket_id",
            type: RelationType.Many,
            children: [
              {
                path: undefined,
                field: "addresses",
                target: "address_bucket_id",
                type: RelationType.Many,
                children: undefined
              }
            ]
          }
        ]);
      });
    });
  });

  describe("path", () => {
    it("should create path from relation map", () => {
      const relationMapObject: RelationMap = {
        field: "order_id",
        target: "order_bucket_id",
        type: RelationType.One,
        children: undefined,
        path: {
          field: "orders",
          type: "object"
        }
      };

      expect(createPathFromRelationMap(relationMapObject)).toEqual("orders.order_id");

      const relationMapArray: RelationMap = {
        field: "order_id",
        target: "order_bucket_id",
        type: RelationType.One,
        children: undefined,
        path: {
          field: "orders",
          type: "array"
        }
      };

      expect(createPathFromRelationMap(relationMapArray)).toEqual("[orders].order_id");

      const relationMapObjectArray: RelationMap = {
        field: "order_id",
        target: "order_bucket_id",
        type: RelationType.One,
        children: undefined,
        path: {
          field: "orders",
          type: "array",
          children: {
            field: "order_info",
            type: "object",
            children: undefined
          }
        }
      };

      expect(createPathFromRelationMap(relationMapObjectArray)).toEqual(
        "[orders].order_info.order_id"
      );
    });
  });

  xdescribe("compareAndUpdateRelations", () => {
    fit("should update used relations", () => {
      const relationMap: RelationMap[] = [
        {
          field: "test",
          target: "bucket_id",
          type: RelationType.One,
          children: [
            {
              field: "child1",
              target: "bucket2_id",
              type: RelationType.Many,
              children: [
                {
                  field: "child3",
                  target: "bucket3_id",
                  type: RelationType.Many,
                  children: [
                    {
                      field: "child4",
                      target: "bucket4_id",
                      type: RelationType.Many
                    }
                  ]
                }
              ]
            },
            {
              field: "child2",
              target: "bucket2_id",
              type: RelationType.One
            }
          ]
        }
      ];

      const usedRelations = ["test"];

      const res = compareAndUpdateRelations(relationMap, usedRelations);

      console.dir(res, {depth: Infinity});
      console.dir(usedRelations, {depth: Infinity});
    });
  });
});
