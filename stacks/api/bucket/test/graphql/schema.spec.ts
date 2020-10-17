import {
  createSchema,
  extractAggregationFromQuery,
  getPatchedDocument,
  getUpdateQuery
} from "../../src/graphql/schema";
import {format as _format} from "prettier";
import {ObjectId} from "@spica-server/database";

export function format(text: string) {
  return _format(text, {parser: "graphql"});
}

describe("Schema", () => {
  describe("CreateSchema", () => {
    let bucket;

    let staticTypes = `
    scalar Date

    scalar JSON

    scalar ObjectID
    
    type Meta{
      total: Int
    }

    type Location{
      latitude: Float
      longitude: Float
    }

    input LocationInput{
      latitude: Float
      longitude: Float
    }
    `;

    let staticPartOfSchema = `
    type Bucket_idFindResponse{
      meta: Meta
      entries: [Bucket_id]
    }

    type Query{
      FindBucket_id(limit: Int, skip: Int, sort: JSON ,language: String, query: JSON): Bucket_idFindResponse
      FindByBucket_idId(_id: ObjectID!, language: String):Bucket_id
    }

    type Mutation{
      insertBucket_id(input: Bucket_idInput): Bucket_id
      replaceBucket_id(_id: ObjectID!, input: Bucket_idInput): Bucket_id
      patchBucket_id(_id: ObjectID!, input: JSON): Bucket_id
      deleteBucket_id(_id: ObjectID!): String
    }
`;

    beforeEach(() => {
      bucket = {
        _id: "id",
        properties: {
          title: {
            type: "string"
          },
          description: {
            type: "textarea"
          }
        }
      };
    });

    it("should create schema for bucket", () => {
      bucket.required = ["title"];
      let schema = createSchema(bucket, staticTypes);

      expect(format(schema)).toEqual(
        format(
          `
          ${staticTypes}

          ${staticPartOfSchema}

          type Bucket_id{
            _id: ObjectID
            title : String!
            description : String
          }
        
          input Bucket_idInput{
            title : String!
            description : String
          }
        `
        )
      );
    });

    it("should create schema for nested object", () => {
      bucket.properties = {
        nested_object: {
          type: "object",
          properties: {
            inner_field: {
              type: "string"
            }
          }
        }
      };

      let schema = createSchema(bucket, "");
      expect(format(schema)).toEqual(
        format(
          `
          ${staticPartOfSchema}

          type Bucket_id{
            _id: ObjectID
            nested_object : Bucket_id_nested_object
          }
  
          type Bucket_id_nested_object{
            inner_field : String
          }
        
          input Bucket_idInput{
            nested_object : Bucket_id_nested_objectInput
          }
  
          input Bucket_id_nested_objectInput{
            inner_field : String
          }
        `
        )
      );
    });

    it("should create schema with enum", () => {
      bucket.properties = {
        roles: {
          type: "string",
          enum: ["AUTHOR", "ADMIN", "USER"]
        }
      };

      let schema = createSchema(bucket, "");

      expect(format(schema)).toEqual(
        format(
          `
          ${staticPartOfSchema}

          type Bucket_id{
            _id: ObjectID
            roles : Bucket_id_roles
          }
  
          enum Bucket_id_roles{
            AUTHOR
            ADMIN
            USER
          }
        
          input Bucket_idInput{
            roles : Bucket_id_roles
          }
        `
        )
      );
    });

    it("should create schema for related fields", () => {
      bucket.properties = {
        onetoone: {
          type: "relation",
          bucketId: "otherid",
          relationType: "onetoone"
        },
        onetomany: {
          type: "relation",
          bucketId: "anotherid",
          relationType: "onetomany"
        }
      };

      let schema = createSchema(bucket, "");

      expect(format(schema)).toEqual(
        format(`
          ${staticPartOfSchema}

          type Bucket_id{
            _id: ObjectID
            onetoone: Bucket_otherid
            onetomany: [Bucket_anotherid]
          }
  
          input Bucket_idInput{
            onetoone: String
            onetomany: [String]
          }
        `)
      );
    });

    it("should create schema for other types", () => {
      bucket.properties = {
        location: {
          type: "location"
        },
        date: {
          type: "date"
        },
        boolean: {
          type: "boolean"
        },
        color: {
          type: "color"
        },
        number: {
          type: "number"
        },
        array: {
          type: "array",
          items: {
            type: "array",
            items: {
              type: "string"
            }
          }
        }
      };

      let schema = createSchema(bucket, "");

      expect(format(schema)).toEqual(
        format(`
        ${staticPartOfSchema}

        type Bucket_id{
          _id: ObjectID
          location : Location
          date: Date
          boolean: Boolean
          color: String
          number: Int
          array: [[String]]
        }

        input Bucket_idInput{
          location : LocationInput
          date: Date
          boolean: Boolean
          color: String
          number: Int
          array: [[String]]
        }
      `)
      );
    });
  });

  describe("AggregationFromQuery", () => {
    let query;
    let bucket;
    beforeEach(() => {
      query = {};
      bucket = {
        _id: "id",
        properties: {
          title: {
            type: "string"
          },
          age: {
            type: "number"
          }
        }
      };
    });

    it("should extract aggregation from query that includes basic equality", () => {
      query = {title: "test"};
      let aggregation = extractAggregationFromQuery(bucket, query, []);
      expect(aggregation).toEqual({title: "test"});
    });

    it("should extract aggregation from query that includes comparision operators", () => {
      query = {title_ne: "test", age_gte: 15};
      let aggregation = extractAggregationFromQuery(bucket, query, []);
      expect(aggregation).toEqual({title: {$ne: "test"}, age: {$gte: 15}});
    });

    it("should extract aggregation from query that includes logical operators", () => {
      query = {
        OR: [
          {
            AND: [
              {
                title_ne: "test"
              },
              {
                age_gte: 15
              }
            ]
          }
        ]
      };
      let aggregation = extractAggregationFromQuery(bucket, query, []);
      expect(aggregation).toEqual({
        $or: [
          {
            $and: [
              {
                title: {
                  $ne: "test"
                }
              },
              {
                age: {
                  $gte: 15
                }
              }
            ]
          }
        ]
      });
    });

    it("should extract aggregation from nested object query", () => {
      bucket.properties = {
        name: {
          type: "string"
        },
        address: {
          type: "object",
          properties: {
            city: {
              type: "string"
            },
            no: {
              type: "string"
            }
          }
        }
      };
      query = {
        name: "Jim",
        address: {
          city: "Antalya",
          no_gt: "50",
          no_lte: "100"
        }
      };
      let aggregation = extractAggregationFromQuery(bucket, query, []);
      expect(aggregation).toEqual({
        name: "Jim",
        "address.city": "Antalya",
        "address.no": {$gt: "50", $lte: "100"}
      });
    });

    it("should ignore part of query that does not match with any bucket property", () => {
      query = {title_ne: "test", country: "some_country"};
      let aggregation = extractAggregationFromQuery(bucket, query, []);
      expect(aggregation).toEqual({title: {$ne: "test"}});
    });

    it("should cast expression values to own original formats", () => {
      let id = new ObjectId().toHexString();
      let date = new Date().toString();

      bucket.properties = {
        _id: {
          type: "objectid"
        },
        created_at: {
          type: "date"
        },
        dates: {
          type: "array",
          items: {
            type: "date"
          }
        }
      };

      query = {
        _id: id,
        created_at_lt: date,
        dates_in: [date]
      };
      let aggregation = extractAggregationFromQuery(bucket, query, []);
      expect(aggregation).toEqual({
        _id: new ObjectId(id),
        created_at: {
          $lt: new Date(date)
        },
        dates: {
          $in: [new Date(date)]
        }
      });
    });
  });

  describe("Merge/Patch", () => {
    it("should get patched document", () => {
      let previousDocument = {
        title: "title",
        description: "description"
      };
      let patchQuery = {
        title: "new_title",
        description: null
      };
      let patchedDocument = getPatchedDocument(previousDocument, patchQuery);
      expect(patchedDocument).toEqual({
        title: "new_title"
      });
    });

    it("should get update query", () => {
      let previousDocument = {
        title: "title",
        description: "description"
      };

      let currentDocument = {
        title: "new_title"
      };

      let query = getUpdateQuery(previousDocument, currentDocument);

      expect(query).toEqual({
        $set: {title: "new_title"},
        $unset: {description: ""}
      });
    });

    it("should get update query for nested objects", () => {
      let previousDocument = {
        nested_object: {
          field1: "dont_touch_me",
          field2: "remove_me"
        }
      };

      let currentDocument = {
        nested_object: {
          field1: "dont_touch_me"
        }
      };

      let query = getUpdateQuery(previousDocument, currentDocument);

      expect(query).toEqual({
        $unset: {"nested_object.field2": ""}
      });
    });

    it("should get update query for arrays", () => {
      let previousDocument = {
        strings: ["value1", "value2"]
      };

      let currentDocument = {
        strings: ["new_value"]
      };

      let query = getUpdateQuery(previousDocument, currentDocument);

      expect(query).toEqual({
        $set: {strings: ["new_value"]}
      });
    });
  });
});
