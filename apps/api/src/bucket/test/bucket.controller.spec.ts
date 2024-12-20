import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {Middlewares} from "@spica-server/core";
import {SchemaModule} from "@spica-server/core/schema";
import {CREATED_AT, UPDATED_AT} from "@spica-server/core/schema/defaults";
import {OBJECTID_STRING, OBJECT_ID, DATE_TIME} from "@spica-server/core/schema/formats";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

jest.setTimeout(10000);

describe("BucketController", () => {
  let app: INestApplication;
  let req: Request;

  let bucket;
  let bucket2;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID, OBJECTID_STRING, DATE_TIME],
          defaults: [CREATED_AT, UPDATED_AT]
        }),
        CoreTestingModule,
        PassportTestingModule.initialize(),
        DatabaseTestingModule.replicaSet(),
        PreferenceTestingModule,
        BucketModule.forRoot({
          hooks: false,
          history: false,
          realtime: false,
          cache: false,
          graphql: false
        })
      ]
    }).compile();
    app = module.createNestApplication();
    req = module.get(Request);
    app.use(Middlewares.MergePatchJsonParser(10));
    await app.listen(req.socket);

    bucket = {
      _id: new ObjectId().toHexString(),
      title: "New Bucket",
      description: "Describe your new bucket",
      icon: "view_stream",
      primary: "title",
      readOnly: false,
      history: true,
      acl: {write: "true==true", read: "true==true"},
      properties: {
        title: {
          type: "string",
          title: "title",
          description: "Title of the row",
          options: {position: "left"}
        },
        description: {
          type: "textarea",
          title: "description",
          description: "Description of the row",
          options: {position: "right"}
        }
      }
    };

    bucket2 = {
      ...bucket,
      _id: new ObjectId().toHexString(),
      properties: {
        name: {
          type: "string",
          title: "title",
          description: "Title of the row",
          options: {position: "left"}
        },
        age: {
          type: "number",
          title: "Age",
          description: "Age of the row",
          options: {position: "right"}
        }
      }
    };
  });

  afterEach(() => app.close());

  describe("get", () => {
    it("should get predefinedDefaults", async () => {
      const response = await req.get("/bucket/predefineddefaults", {});
      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);

      const defaults = response.body;
      expect(defaults.length).toBe(2);
      expect(defaults).toEqual([
        {match: ":created_at", type: "date"},
        {match: ":updated_at", type: "date"}
      ]);
    });

    it("should get specific bucket", async () => {
      const {body: inserted} = await req.post("/bucket", bucket);
      const {body: bkt} = await req.get(`/bucket/${inserted._id}`);
      expect(bkt).toEqual(bucket);
    });

    it("should get all buckets", async () => {
      const {body: firstBucket} = await req.post("/bucket", bucket);
      const {body: secondBucket} = await req.post("/bucket", bucket2);

      const {body: buckets} = await req.get("/bucket");
      expect(buckets.length).toBe(2);
      expect(buckets).toEqual([firstBucket, secondBucket]);
    });
  });

  describe("add/update", () => {
    it("should add new bucket and return it", async () => {
      const {body: inserted} = await req.post("/bucket", bucket);
      expect(inserted).toEqual(bucket);

      const {body: buckets} = await req.get("/bucket");

      expect(buckets.length).toBe(1);
      expect(buckets[0]).toEqual(bucket);
    });

    it("should add new bucket and create object id if it's not provided", async () => {
      delete bucket._id;
      const {body: inserted} = await req.post("/bucket", bucket);

      expect(ObjectId.isValid(inserted._id)).toEqual(true);
      expect(inserted).toEqual({...bucket, _id: inserted._id});

      const {body: buckets} = await req.get("/bucket");

      expect(buckets.length).toBe(1);

      expect(ObjectId.isValid(buckets[0]._id)).toEqual(true);
      expect(buckets[0]).toEqual({...bucket, _id: buckets[0]._id});
    });

    it("should replace a single bucket", async () => {
      const {body: insertedBucket} = await req.post("/bucket", bucket);
      const updatedBucket = {
        ...insertedBucket,
        primary: "firstname",
        properties: {
          firstname: {
            type: "string",
            title: "firstname",
            description: "Firstname",
            options: {position: "left"}
          },
          lastname: {
            type: "string",
            title: "lastname",
            description: "Lastname",
            options: {position: "left"}
          }
        }
      };

      const {body: updateResult} = await req.put(`/bucket/${updatedBucket._id}`, updatedBucket);
      expect(updateResult).toEqual(updatedBucket);

      const {body: buckets} = await req.get("/bucket");
      expect(buckets.length).toBe(1);
      expect(buckets[0]).toEqual(updatedBucket);
    });

    it("should update patch buckets", async () => {
      const {body: firstBucket} = await req.post("/bucket", {...bucket, title: "First Bucket"});
      const {body: secondBucket} = await req.post("/bucket", {...bucket2, title: "Second Bucket"});

      await req.patch(
        `/bucket/${firstBucket._id}`,
        {order: 2, category: "cat1"},
        {
          "content-type": "application/merge-patch+json"
        }
      );
      await req.patch(
        `/bucket/${secondBucket._id}`,
        {order: 1, category: "cat2"},
        {
          "content-type": "application/merge-patch+json"
        }
      );

      const {body: buckets} = await req.get("/bucket");
      expect(
        buckets.map(bucket => {
          return {title: bucket.title, category: bucket.category, order: bucket.order};
        })
      ).toEqual([
        {
          title: "Second Bucket",
          category: "cat2",
          order: 1
        },
        {
          title: "First Bucket",
          category: "cat1",
          order: 2
        }
      ]);

      await req.patch(
        `/bucket/${secondBucket._id}`,
        {order: null, category: null},
        {
          "content-type": "application/merge-patch+json"
        }
      );

      const patchedBucket = await req.get(`/bucket/${secondBucket._id}`).then(r => r.body);

      expect(patchedBucket.order).toBeUndefined();
      expect(patchedBucket.category).toBeUndefined();
    });
  });

  describe("delete", () => {
    it("should delete spesific bucket and it's documents", async () => {
      const firstInsertedBukcet = (await req.post("/bucket", bucket)).body;
      const secondInsertedBucket = (await req.post("/bucket", bucket2)).body;

      let {body: insertedDocument} = await req.post(`/bucket/${secondInsertedBucket._id}/data`, {
        name: "name",
        age: 18
      });

      let {body: bucketDocuments} = await req.get(`/bucket/${secondInsertedBucket._id}/data`, {});
      expect(bucketDocuments).toEqual([insertedDocument]);

      let deleteResponse = await req.delete(`/bucket/${secondInsertedBucket._id}`);
      expect([deleteResponse.statusCode, deleteResponse.statusText]).toEqual([204, "No Content"]);

      const buckets = (await req.get("/bucket", {})).body;
      expect(buckets.length).toBe(1);
      expect(buckets[0]).toEqual(firstInsertedBukcet);

      let getDataResponse = await req.get(`/bucket/${secondInsertedBucket._id}/data`, {});
      expect([getDataResponse.statusCode, getDataResponse.statusText]).toEqual([404, "Not Found"]);
    });
  });

  describe("validation", () => {
    let bucket;

    beforeEach(() => {
      bucket = {
        title: "New Bucket",
        description: "Describe your new bucket",
        icon: "view_stream",
        primary: "title",
        readOnly: false,
        properties: {
          title: {
            type: "string",
            title: "title",
            description: "Title of the row",
            options: {position: "left"}
          },
          description: {
            type: "textarea",
            title: "description",
            description: "Description of the row",
            options: {position: "right"}
          }
        }
      };
    });

    describe("title", () => {
      it("should show error about minLength ", async () => {
        bucket.title = "asd";
        const response = await req.post("/bucket", bucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".title should NOT have fewer than 4 items",
          "validation failed"
        ]);
      });

      it("should show error about maxLength ", async () => {
        bucket.title = "a".repeat(101);
        const response = await req.post("/bucket", bucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".title should NOT have more than 100 items",
          "validation failed"
        ]);
      });
    });

    describe("description", () => {
      it("should show error about minlength ", async () => {
        bucket.description = "asde";
        const response = await req.post("/bucket", bucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".description should NOT have fewer than 5 items",
          "validation failed"
        ]);
      });

      it("should show error about maxLength ", async () => {
        bucket.description = "a".repeat(251);
        const response = await req.post("/bucket", bucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".description should NOT have more than 250 items",
          "validation failed"
        ]);
      });
    });

    describe("icon", () => {
      it("should show error about type", async () => {
        bucket.icon = 333;
        const response = await req.post("/bucket", bucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".icon should be string",
          "validation failed"
        ]);
      });

      it("should set 'view_stream' as default value", async () => {
        delete bucket.icon;
        const response = await req.post("/bucket", bucket);
        expect([response.statusCode, response.statusText]).toEqual([201, "Created"]);
        expect(response.body.icon).toEqual("view_stream");
      });
    });

    it("should show error about primary type", async () => {
      bucket.primary = [];
      const response = await req.post("/bucket", bucket);
      expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
      expect([response.body.message, response.body.error]).toEqual([
        ".primary should be string",
        "validation failed"
      ]);
    });

    it("should show error about order type", async () => {
      bucket.order = "1";
      const response = await req.post("/bucket", bucket);
      expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
      expect([response.body.message, response.body.error]).toEqual([
        ".order should be number",
        "validation failed"
      ]);
    });

    describe("required", () => {
      it("should show error about type", async () => {
        bucket.required = {asd: "qwe"};
        const response = await req.post("/bucket", bucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".required should be array",
          "validation failed"
        ]);
      });

      it("should show error about array items type", async () => {
        bucket.required = ["asd", 1];
        const response = await req.post("/bucket", bucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".required.1 should be string",
          "validation failed"
        ]);
      });

      it("should show error when array items arent unique ", async () => {
        bucket.required = ["asd", "asd", "qwe", "zxc"];
        const response = await req.post("/bucket", bucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".required should NOT have duplicate items (items ## 1 and 0 are identical)",
          "validation failed"
        ]);
      });
    });

    it("should show error about readonly type", async () => {
      bucket.readOnly = "true";
      const response = await req.post("/bucket", bucket);
      expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
      expect([response.body.message, response.body.error]).toEqual([
        ".readOnly should be boolean",
        "validation failed"
      ]);
    });

    describe("properties", () => {
      it("should show error about type", async () => {
        bucket.properties = 1;
        const response = await req.post("/bucket", bucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".properties should be object",
          "validation failed"
        ]);
      });

      it("should show error about title type", async () => {
        bucket.properties.title.type = 333;
        const response = await req.post("/bucket", bucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".properties.title.type should be equal to one of the allowed values",
          "validation failed"
        ]);
      });

      it("should show error about title type which isnt available", async () => {
        bucket.properties.title.type = "hashmap";
        const response = await req.post("/bucket", bucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".properties.title.type should be equal to one of the allowed values",
          "validation failed"
        ]);
      });

      it("should show error about title", async () => {
        bucket.properties.title.title = 333;
        const response = await req.post("/bucket", bucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".properties.title.title should be string",
          "validation failed"
        ]);
      });

      it("should show error about title description", async () => {
        bucket.properties.title.description = ["asdqwe", "ahsgdasd"];
        const response = await req.post("/bucket", bucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".properties.title.description should be string",
          "validation failed"
        ]);
      });

      it("should show error about title options type", async () => {
        bucket.properties.title.options = "asd";
        const response = await req.post("/bucket", bucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".properties.title.options should be object",
          "validation failed"
        ]);
      });

      it("should show error about title translate type", async () => {
        bucket.properties.title.options.translate = 33;
        const response = await req.post("/bucket", bucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".properties.title.options.translate should be boolean",
          "validation failed"
        ]);
      });

      it("should show error about title history type", async () => {
        bucket.properties.title.options.history = "false";
        const response = await req.post("/bucket", bucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".properties.title.options.history should be boolean",
          "validation failed"
        ]);
      });

      it("should show error about title position type", async () => {
        bucket.properties.title.options.position = ["bottom,left"];
        const response = await req.post("/bucket", bucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".properties.title.options.position should be string",
          "validation failed"
        ]);
      });

      it("should show error about title position value which isn't available", async () => {
        bucket.properties.title.options.position = "top";
        const response = await req.post("/bucket", bucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".properties.title.options.position should be equal to one of the allowed values",
          "validation failed"
        ]);
      });
    });

    describe("relation", () => {
      it("should show error about bucketId", async () => {
        bucket.properties.books = {
          type: "relation",
          relationType: "onetoone"
        };

        const response = await req.post("/bucket", bucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".properties.books should have required property 'bucketId'",
          "validation failed"
        ]);
      });

      it("should show error about relationType", async () => {
        bucket.properties.books = {
          type: "relation",
          bucketId: "id"
        };

        const response = await req.post("/bucket", bucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".properties.books should have required property 'relationType'",
          "validation failed"
        ]);
      });
    });
  });

  describe("clear removed and updated fields", () => {
    let bucketId;
    let bucketDataId;
    let previousSchema = {
      title: "test_title",
      description: "test_desc",
      properties: {
        nested_object: {
          type: "object",
          options: {},
          properties: {
            nested_object_child: {
              type: "object",
              properties: {
                removed: {type: "string"},
                updated: {type: "string"},
                not_removed_or_updated: {type: "string"}
              }
            }
          }
        },
        nested_array_object: {
          type: "array",
          options: {},
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                removed: {type: "string"},
                updated: {type: "string"},
                not_removed_or_updated: {type: "string"}
              }
            }
          }
        },
        root_removed: {
          type: "string",
          options: {}
        },
        root_updated: {
          type: "string",
          options: {}
        },
        root_not_removed_or_updated: {
          type: "string",
          options: {}
        },
        nested_root_removed: {
          type: "object",
          properties: {
            dont_check_me: {
              type: "string"
            }
          }
        },
        nested_root_updated: {
          type: "object",
          properties: {
            dont_check_me: {
              type: "string"
            }
          }
        }
      }
    };

    let updatedSchema = {
      title: "test_title",
      description: "test_desc",
      properties: {
        nested_object: {
          type: "object",
          options: {},
          properties: {
            nested_object_child: {
              type: "object",
              properties: {
                updated: {type: "boolean"},
                not_removed_or_updated: {type: "string"}
              }
            }
          }
        },
        nested_array_object: {
          type: "array",
          options: {},
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                updated: {type: "date"},
                not_removed_or_updated: {type: "string"}
              }
            }
          }
        },
        root_updated: {
          type: "date",
          options: {}
        },
        root_not_removed_or_updated: {
          type: "string",
          options: {}
        },
        nested_root_updated: {
          type: "number"
        }
      }
    };

    let bucketData = {
      nested_object: {
        nested_object_child: {
          removed: "removed",
          updated: "updated",
          not_removed_or_updated: "not_removed_or_updated"
        }
      },
      nested_array_object: [
        [
          {
            removed: "removed",
            updated: "updated",
            not_removed_or_updated: "not_removed_or_updated"
          },
          {
            removed: "removed",
            updated: "updated",
            not_removed_or_updated: "not_removed_or_updated"
          }
        ]
      ],
      root_removed: "removed",
      root_updated: "updated",
      root_not_removed_or_updated: "root_not_removed_or_updated"
    };
    beforeEach(async () => {
      bucketId = (await req.post("/bucket", previousSchema)).body._id;
      bucketDataId = (await req.post(`/bucket/${bucketId}/data`, bucketData)).body._id;
    });

    it("should update bucket document when bucket schema updated", async () => {
      await req.put(`/bucket/${bucketId}`, updatedSchema);
      let {body: updatedBucketDocument} = await req.get(
        `/bucket/${bucketId}/data/${bucketDataId}`,
        {}
      );
      expect(updatedBucketDocument).toEqual({
        _id: bucketDataId,
        nested_object: {
          nested_object_child: {
            not_removed_or_updated: "not_removed_or_updated"
          }
        },
        nested_array_object: [
          [
            {
              not_removed_or_updated: "not_removed_or_updated"
            },
            {
              not_removed_or_updated: "not_removed_or_updated"
            }
          ]
        ],
        root_not_removed_or_updated: "root_not_removed_or_updated"
      });
    });
  });

  describe("delete bucket,data and related data", () => {
    let usersBucket;
    let scoresBucket;
    let settingsBucket;

    let user;
    let score;
    let setting;

    beforeEach(async () => {
      usersBucket = await req
        .post("/bucket", {
          title: "Users",
          description: "Users bucket",
          properties: {
            name: {
              type: "string",
              options: {}
            }
          }
        })
        .then(res => res.body);

      settingsBucket = await req
        .post("/bucket", {
          title: "Settings",
          description: "Settings Bucket",
          properties: {
            setting: {
              type: "string",
              options: {}
            }
          }
        })
        .then(res => res.body);

      scoresBucket = await req
        .post("/bucket", {
          title: "Scores",
          description: "Scores bucket",
          properties: {
            score: {
              type: "number",
              options: {}
            },
            user: {
              type: "relation",
              bucketId: usersBucket._id,
              relationType: "onetoone",
              options: {}
            },
            setting: {
              type: "relation",
              bucketId: settingsBucket._id,
              relationType: "onetoone",
              options: {}
            }
          }
        })
        .then(res => res.body);

      user = await req
        .post(`/bucket/${usersBucket._id}/data`, {
          name: "user1"
        })
        .then(res => res.body);

      setting = await req
        .post(`/bucket/${settingsBucket._id}/data`, {
          setting: "setting1"
        })
        .then(res => res.body);

      score = await req
        .post(`/bucket/${scoresBucket._id}/data`, {
          score: 500,
          user: user._id,
          setting: setting._id
        })
        .then(res => res.body);
    });

    it("should delete users, update scores bucket schema and data when the users bucket deleted", async () => {
      const deleteResponse = await req.delete(`/bucket/${usersBucket._id}`);
      expect([deleteResponse.statusCode, deleteResponse.statusText]).toEqual([204, "No Content"]);
      expect(deleteResponse.body).toEqual(undefined);

      const {body: usersBucketResponse} = await req.get(`/bucket/${usersBucket._id}`, {});
      expect(usersBucketResponse).toBeUndefined();

      const usersDocumentResponse = await req.get(`/bucket/${usersBucket._id}/data`, {});
      expect([usersDocumentResponse.statusCode, usersDocumentResponse.statusText]).toEqual([
        404,
        "Not Found"
      ]);

      const {body: scoresBucketResponse} = await req.get(`/bucket/${scoresBucket._id}`, {});
      expect(scoresBucketResponse.properties).toEqual({
        score: {
          type: "number",
          options: {}
        },
        setting: {
          type: "relation",
          bucketId: settingsBucket._id,
          relationType: "onetoone",
          options: {},
          dependent: false
        }
      });

      const {body: scoresDocumentResponse} = await req.get(`/bucket/${scoresBucket._id}/data`, {});

      expect(scoresDocumentResponse).toEqual([
        {
          _id: score._id,
          score: 500,
          setting: setting._id
        }
      ]);
    });

    it("should update scores when scores bucket schema relation type changed", async () => {
      const updatedScoresBucket = {
        title: "Scores",
        description: "Scores bucket",
        properties: {
          score: {
            type: "number",
            options: {}
          },
          user: {
            type: "relation",
            bucketId: usersBucket._id,
            //relation type changes
            relationType: "onetomany",
            options: {}
          },
          setting: {
            type: "relation",
            bucketId: settingsBucket._id,
            relationType: "onetoone",
            options: {}
          }
        }
      };
      await req.put(`/bucket/${scoresBucket._id}`, updatedScoresBucket);

      const {body} = await req.get(`/bucket/${scoresBucket._id}/data`);

      expect(body).toEqual([
        {
          _id: score._id,
          score: 500,
          setting: setting._id
        }
      ]);
    });

    it("should update scores when scores bucket schema relational bucket changed", async () => {
      const updatedScoresBucket = {
        title: "Scores",
        description: "Scores bucket",
        properties: {
          score: {
            type: "number",
            options: {}
          },
          user: {
            type: "relation",
            //relational bucket changes
            bucketId: settingsBucket._id,
            relationType: "onetoone",
            options: {}
          },
          setting: {
            type: "relation",
            bucketId: settingsBucket._id,
            relationType: "onetoone",
            options: {}
          }
        }
      };
      await req.put(`/bucket/${scoresBucket._id}`, updatedScoresBucket);

      const {body} = await req.get(`/bucket/${scoresBucket._id}/data`);

      expect(body).toEqual([
        {
          _id: score._id,
          score: 500,
          setting: setting._id
        }
      ]);
    });
  });
});
