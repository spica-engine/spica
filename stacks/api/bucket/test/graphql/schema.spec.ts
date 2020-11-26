import {format as _format} from "prettier";
import {
  createSchema,
  extractAggregationFromQuery,
  getProjectAggregation,
  requestedFieldsFromExpression,
  requestedFieldsFromInfo
} from "../../src/graphql/schema";

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

    let commonDefinitions = `
    type Bucket_idFindResponse{
      meta: Meta
      data: [Bucket_id]
    }

    type Query{
      FindBucket_id(limit: Int, skip: Int, sort: JSON, language: String, schedule: Boolean, query: JSON): Bucket_idFindResponse
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
      let schema = createSchema(bucket, staticTypes, [], []);

      expect(format(schema)).toEqual(
        format(
          `
          ${staticTypes}

          ${commonDefinitions}

          type Bucket_id{
            _id: ObjectID
            title : String
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

      let schema = createSchema(bucket, "", [], []);
      expect(format(schema)).toEqual(
        format(
          `
          ${commonDefinitions}

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
          enum: [
            "AUTHOR",
            "ADMIN",
            "USER",
            //duplicated value
            "AUTHOR"
          ]
        }
      };

      let schema = createSchema(bucket, "", [], []);

      expect(format(schema)).toEqual(
        format(
          `
          ${commonDefinitions}

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
        ),
        "should work if duplicated value removed"
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

      let schema = createSchema(bucket, "", ["otherid", "anotherid"], []);

      expect(format(schema)).toEqual(
        format(`
          ${commonDefinitions}

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
        storage: {
          type: "storage"
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

      let schema = createSchema(bucket, "", [], []);

      expect(format(schema)).toEqual(
        format(`
        ${commonDefinitions}

        type Bucket_id{
          _id: ObjectID
          location : Location
          date: Date
          boolean: Boolean
          color: String
          number: Int
          storage: String
          array: [[String]]
        }

        input Bucket_idInput{
          location : LocationInput
          date: Date
          boolean: Boolean
          color: String
          number: Int
          storage: String
          array: [[String]]
        }
      `)
      );
    });

    describe("errors", () => {
      it("should replace name of field, convert type of value to String and push errors", () => {
        bucket.properties = {
          "123invalid,name?*.": {
            type: "object"
          }
        };

        let errors = [];
        let schema = createSchema(bucket, "", [], errors);
        expect(format(schema)).toEqual(
          format(`
          ${commonDefinitions}
  
          type Bucket_id{
            _id: ObjectID
            _123invalid_name___: String
          }
  
          input Bucket_idInput{
            _123invalid_name___: String
          }
        `)
        );
        expect(errors).toEqual([
          {
            target: "Bucket_id.123invalid,name?*.",
            reason:
              "Name specification must start with an alphabetic character and can not include any non-letter character."
          }
        ]);
      });

      it("should convert enum type definition to String and push errors if enum includes invalid value", () => {
        bucket.properties = {
          shapes: {
            type: "string",
            enum: ["2D", "3D"]
          }
        };

        let errors = [];
        let schema = createSchema(bucket, "", [], errors);
        expect(format(schema)).toEqual(
          format(`
          ${commonDefinitions}
  
          type Bucket_id{
            _id: ObjectID
            shapes: String
          }
  
          input Bucket_idInput{
            shapes: String
          }
        `)
        );
        expect(errors).toEqual([
          {
            target: "Bucket_id.shapes",
            reason:
              "Enums must start with an alphabetic character and can not include any non-letter character."
          }
        ]);
      });

      it("should convert relation type definition to String and push errors if related bucket does not exist", () => {
        bucket.properties = {
          books: {
            type: "relation",
            bucketId: "non_exist_bucket_id"
          }
        };

        let errors = [];
        let schema = createSchema(bucket, "", [], errors);
        expect(format(schema)).toEqual(
          format(`
          ${commonDefinitions}
  
          type Bucket_id{
            _id: ObjectID
            books: String
          }
  
          input Bucket_idInput{
            books: String
          }
        `)
        );
        expect(errors).toEqual([
          {
            target: "Bucket_id.books",
            reason: "Related bucket 'non_exist_bucket_id' does not exist."
          },
          {
            target: "Bucket_id.books",
            reason: "Relation type 'undefined' is invalid type."
          }
        ]);
      });

      it("should make type definition to String if type is invalid", () => {
        bucket.properties = {
          average: {
            type: "float"
          }
        };

        let errors = [];
        let schema = createSchema(bucket, "", [], errors);
        expect(format(schema)).toEqual(
          format(`
          ${commonDefinitions}
  
          type Bucket_id{
            _id: ObjectID
            average: String
          }
  
          input Bucket_idInput{
            average: String
          }
        `)
        );
        expect(errors).toEqual([
          {
            target: "Bucket_id.average",
            reason: "Type 'float' is invalid type."
          }
        ]);
      });
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
      let date = new Date().toString();

      bucket.properties = {
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
        created_at_lt: date,
        dates_in: [date]
      };
      let aggregation = extractAggregationFromQuery(bucket, query, []);
      expect(aggregation).toEqual({
        created_at: {
          $lt: new Date(date)
        },
        dates: {
          $in: [new Date(date)]
        }
      });
    });
  });

  describe("RequestedFields", () => {
    it("should find requested fields", () => {
      let info: any = {
        fieldNodes: [
          {
            name: {
              value: "find_my_entry"
            },
            selectionSet: {
              selections: [
                {
                  name: {
                    value: "name"
                  }
                },
                {
                  name: {
                    value: "surname"
                  }
                },
                {
                  name: {
                    value: "address"
                  },
                  selectionSet: {
                    selections: [
                      {
                        name: {
                          value: "city"
                        }
                      },
                      {
                        name: {
                          value: "street"
                        }
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      };

      let requestedFields = requestedFieldsFromInfo(info);

      expect(requestedFields).toEqual([
        ["name"],
        ["surname"],
        ["address", "city"],
        ["address", "street"]
      ]);
    });

    it("should extract requested fields from expression", () => {
      let expression = {
        status: true,
        $or: [
          {
            $or: [
              {
                name: {$regex: "test"}
              },
              {
                age: {$gte: 12, lt: 21}
              }
            ]
          },
          {
            "address.city": "paris"
          },
          {
            age: 20
          }
        ]
      };

      let requestedFields = requestedFieldsFromExpression(expression, []);
      expect(requestedFields).toEqual([
        ["status"],
        ["name"],
        ["age"],
        ["address", "city"],
        ["age"]
      ]);
    });

    it("should find requested fields from specified root key,and merge them", () => {
      let info: any = {
        fieldNodes: [
          {
            name: {
              value: "find_my_all_documents"
            },
            selectionSet: {
              selections: [
                {
                  name: {
                    value: "meta"
                  },
                  selectionSet: {
                    selections: [
                      {
                        name: {
                          value: "total"
                        }
                      }
                    ]
                  }
                },
                {
                  name: {
                    value: "data"
                  },
                  selectionSet: {
                    selections: [
                      {
                        name: {
                          value: "name"
                        }
                      },
                      {
                        name: {
                          value: "surname"
                        }
                      }
                    ]
                  }
                },
                {
                  name: {
                    value: "data"
                  },
                  selectionSet: {
                    selections: [
                      {
                        name: {
                          value: "created_at"
                        }
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      };

      let requestedFields = requestedFieldsFromInfo(info, "data");

      expect(requestedFields).toEqual([["name"], ["surname"], ["created_at"]]);
    });

    describe("aggregations", () => {
      let bucket;
      let localeFactory;
      let buckets;

      let relatedBucket;

      beforeEach(() => {
        bucket = {
          _id: "first_bucket_id",
          properties: {
            name: {
              type: "string"
            },
            translatable_field: {
              type: "string",
              options: {
                translate: true
              }
            },
            to_second_bucket: {
              type: "relation",
              relationType: "onetoone",
              bucketId: "second_bucket_id"
            }
          }
        };

        relatedBucket = {
          _id: "second_bucket_id",
          properties: {
            title: {
              type: "string"
            },
            to_first_bucket: {
              type: "relation",
              relationType: "onetoone",
              bucketId: "first_bucket_id"
            }
          }
        };

        buckets = [bucket, relatedBucket];

        localeFactory = jasmine
          .createSpy("localeFactory")
          .and.returnValue(Promise.resolve({best: "EN", fallback: "EN"}));
      });

      it("should create project aggregation from requested fields", () => {
        let fields = [
          ["name"],
          ["to_second_bucket", "title"],
          ["to_second_bucket", "to_first_bucket", "name"],
          ["to_second_bucket", "to_first_bucket", "translatable_field"],
          ["translatable_field"]
        ];

        let project = getProjectAggregation(fields);
        expect(project).toEqual({
          $project: {
            name: 1,
            "to_second_bucket.title": 1,
            "to_second_bucket.to_first_bucket.name": 1,
            "to_second_bucket.to_first_bucket.translatable_field": 1,
            translatable_field: 1
          }
        });
      });
    });
  });
});
