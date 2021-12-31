import {
  findRelations,
  getUpdateParams,
  isArray,
  isObject,
  isDesiredRelation,
  RelationType
} from "@spica-server/bucket/common";
import {buildRelationAggregation} from "../relation";

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

  fit("should build relation aggregation for nested array objects", () => {
    const property = "[foods].food_id";
    const bucketId = "some_id";
    const type = RelationType.One;

    const aggregation = buildRelationAggregation(property, bucketId, type, undefined);
    expect(aggregation).toEqual([
      [
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
            foods: {$push: "foods"}
          }
        },
        {$addFields: {"_doc_.foods": "$foods"}},
        {$replaceRoot: {newRoot: "$_doc_"}}
      ]
    ]);
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
});
