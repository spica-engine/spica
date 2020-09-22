import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {Middlewares} from "@spica-server/core";
import {SchemaModule} from "@spica-server/core/schema";
import {
  CREATED_AT,
  OBJECTID_STRING,
  OBJECT_ID,
  UPDATED_AT
} from "@spica-server/core/schema/defaults";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe("Bucket acceptance", () => {
  let app: INestApplication;
  let req: Request;

  const bucket = {
    _id: new ObjectId(),
    title: "New Bucket",
    description: "Describe your new bucket",
    icon: "view_stream",
    primary: "title",
    readOnly: false,
    history: true,
    properties: {
      title: {
        type: "string",
        title: "title",
        description: "Title of the row",
        options: {position: "left", visible: true}
      },
      description: {
        type: "textarea",
        title: "description",
        description: "Description of the row",
        options: {position: "right"}
      }
    }
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID, OBJECTID_STRING],
          defaults: [CREATED_AT, UPDATED_AT]
        }),
        CoreTestingModule,
        PassportTestingModule.initialize(),
        DatabaseTestingModule.replicaSet(),
        PreferenceTestingModule,
        BucketModule.forRoot({
          hooks: false,
          history: false,
          realtime: false
        })
      ]
    }).compile();
    app = module.createNestApplication();
    req = module.get(Request);
    app.use(Middlewares.MergePatchJsonParser(10));
    await app.listen(req.socket);
  });

  afterEach(() => app.close());

  describe("get requests", () => {
    it("should get predefinedDefaults", async () => {
      const response = await req.get("/bucket/predefineddefaults", {});
      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);

      const defaults = response.body;
      expect(defaults.length).toBe(2);
      expect(defaults).toEqual([
        {keyword: ":created_at", type: "date"},
        {keyword: ":updated_at", type: "date"}
      ]);
    });

    it("should get specific bucket", async () => {
      //add bucket
      const insertedBucket = (await req.post("/bucket", bucket)).body;

      //get bucket
      const response = await req.get(`/bucket/${insertedBucket._id}`, {});
      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
      expect(response.body).toEqual({
        _id: insertedBucket._id,
        title: "New Bucket",
        description: "Describe your new bucket",
        icon: "view_stream",
        primary: "title",
        readOnly: false,
        history: true,
        properties: {
          title: {
            type: "string",
            title: "title",
            description: "Title of the row",
            options: {position: "left", visible: true}
          },
          description: {
            type: "textarea",
            title: "description",
            description: "Description of the row",
            options: {position: "right"}
          }
        }
      });
    });

    it("should get all buckets", async () => {
      //add buckets
      const firstBucket = (await req.post("/bucket", bucket)).body;
      const secondBucket = (await req.post("/bucket", {
        ...bucket,
        properties: {
          name: {
            type: "string",
            title: "title",
            description: "Title of the row",
            options: {position: "left", visible: true}
          },
          age: {
            type: "number",
            title: "Age",
            description: "Age of the row",
            options: {position: "right", visible: true}
          }
        }
      })).body;

      const response = await req.get("/bucket", {});
      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);

      const buckets = response.body;
      expect(buckets.length).toBe(2);
      expect(buckets).toEqual([firstBucket, secondBucket]);
    });
  });

  describe("add/update requests", () => {
    it("should add new bucket and return it", async () => {
      let response = await req.post("/bucket", bucket);
      delete response.body._id;
      expect([response.statusCode, response.statusText]).toEqual([201, "Created"]);
      expect(response.body).toEqual({
        title: "New Bucket",
        description: "Describe your new bucket",
        icon: "view_stream",
        primary: "title",
        readOnly: false,
        history: true,
        properties: {
          title: {
            type: "string",
            title: "title",
            description: "Title of the row",
            options: {position: "left", visible: true}
          },
          description: {
            type: "textarea",
            title: "description",
            description: "Description of the row",
            options: {position: "right"}
          }
        }
      });

      //get buckets to check updates
      let buckets = (await req.get("/bucket", {})).body;
      expect(buckets.length).toBe(1);
      delete buckets[0]._id;
      expect(buckets[0]).toEqual({
        title: "New Bucket",
        description: "Describe your new bucket",
        icon: "view_stream",
        primary: "title",
        readOnly: false,
        history: true,
        properties: {
          title: {
            type: "string",
            title: "title",
            description: "Title of the row",
            options: {position: "left", visible: true}
          },
          description: {
            type: "textarea",
            title: "description",
            description: "Description of the row",
            options: {position: "right"}
          }
        }
      });
    });

    it("should replace a single bucket", async () => {
      // add bucket
      const insertedBucket = (await req.post("/bucket", bucket)).body;

      //update bucket
      const updatedBucket = {
        ...insertedBucket,
        primary: "firstname",
        properties: {
          firstname: {
            type: "string",
            title: "firstname",
            description: "Firstname",
            options: {position: "left", visible: true}
          },
          lastname: {
            type: "string",
            title: "lastname",
            description: "Lastname",
            options: {position: "left", visible: true}
          }
        }
      };

      const response = await req.put(`/bucket/${updatedBucket._id}`, updatedBucket);
      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
      expect(response.body).toEqual(updatedBucket);

      //get buckets to check updates
      const buckets = (await req.get("/bucket", {})).body;
      expect(buckets.length).toBe(1);
      expect(buckets[0]).toEqual(updatedBucket);
    });

    it("should update bucket indexes", async () => {
      //add buckets
      const firstBucket = (await req.post("/bucket", {...bucket, title: "First Bucket"})).body;
      const secondBucket = (await req.post("/bucket", {...bucket, title: "Second Bucket"})).body;
      const thirdBucket = (await req.post("/bucket", {...bucket, title: "Third Bucket"})).body;

      //update their indexes
      await req.patch(
        `/bucket/${firstBucket._id}`,
        {order: 3},
        {
          "content-type": "application/merge-patch+json"
        }
      );
      await req.patch(
        `/bucket/${secondBucket._id}`,
        {order: 1},
        {
          "content-type": "application/merge-patch+json"
        }
      );
      await req.patch(
        `/bucket/${thirdBucket._id}`,
        {order: 2},
        {
          "content-type": "application/merge-patch+json"
        }
      );

      const buckets = (await req.get("/bucket", {})).body;

      expect(buckets.map(bucket => bucket.title)).toEqual([
        "Second Bucket",
        "Third Bucket",
        "First Bucket"
      ]);
    });
  });

  describe("delete requests", () => {
    it("should delete spesific bucket and it's documents", async () => {
      const firstInsertedBukcet = (await req.post("/bucket", bucket)).body;
      const secondInsertedBucket = (await req.post("/bucket", bucket)).body;

      let {body: insertedDocument} = await req.post(`/bucket/${secondInsertedBucket._id}/data`, {
        title: "title",
        description: "description"
      });

      let {body: bucketDocuments} = await req.get(`/bucket/${secondInsertedBucket._id}/data`, {});
      expect(bucketDocuments).toBeDefined([insertedDocument]);

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
    const validBucket: any = {
      _id: new ObjectId(),
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
          options: {position: "left", visible: true}
        },
        description: {
          type: "textarea",
          title: "description",
          description: "Description of the row",
          options: {position: "right"}
        }
      }
    };

    describe("title", () => {
      it("should show error about minLength ", async () => {
        const invalidBucket = {...validBucket, title: "asd"};
        const response = await req.post("/bucket", invalidBucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".title should NOT be shorter than 4 characters",
          "validation failed"
        ]);
      });

      it("should show error about maxLength ", async () => {
        const invalidBucket = {...validBucket, title: "a".repeat(101)};
        const response = await req.post("/bucket", invalidBucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".title should NOT be longer than 100 characters",
          "validation failed"
        ]);
      });
    });

    describe("description", () => {
      it("should show error about minlength ", async () => {
        const invalidBucket = {...validBucket, description: "asde"};
        const response = await req.post("/bucket", invalidBucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".description should NOT be shorter than 5 characters",
          "validation failed"
        ]);
      });

      it("should show error about maxLength ", async () => {
        const invalidBucket = {...validBucket, description: "a".repeat(251)};
        const response = await req.post("/bucket", invalidBucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".description should NOT be longer than 250 characters",
          "validation failed"
        ]);
      });
    });

    describe("icon", () => {
      it("should show error about type", async () => {
        const invalidBucket = {...validBucket, icon: 333};
        const response = await req.post("/bucket", invalidBucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".icon should be string",
          "validation failed"
        ]);
      });

      it("should set 'view_stream' as default value", async () => {
        let newBucket = {...validBucket};
        delete newBucket.icon;
        const response = await req.post("/bucket", newBucket);
        expect([response.statusCode, response.statusText]).toEqual([201, "Created"]);
        expect(response.body.icon).toEqual("view_stream");
      });
    });

    it("should show error about primary type", async () => {
      const invalidBucket = {...validBucket, primary: []};
      const response = await req.post("/bucket", invalidBucket);
      expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
      expect([response.body.message, response.body.error]).toEqual([
        ".primary should be string",
        "validation failed"
      ]);
    });

    it("should show error about order type", async () => {
      const invalidBucket = {...validBucket, order: "1"};
      const response = await req.post("/bucket", invalidBucket);
      expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
      expect([response.body.message, response.body.error]).toEqual([
        ".order should be number",
        "validation failed"
      ]);
    });

    describe("required", () => {
      it("should show error about type", async () => {
        const invalidBucket = {...validBucket, required: {asd: "qwe"}};
        const response = await req.post("/bucket", invalidBucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".required should be array",
          "validation failed"
        ]);
      });

      it("should show error about array items type", async () => {
        const invalidBucket = {...validBucket, required: ["asd", 1]};
        const response = await req.post("/bucket", invalidBucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".required[1] should be string",
          "validation failed"
        ]);
      });

      it("should show error when array items arent unique ", async () => {
        const invalidBucket = {...validBucket, required: ["asd", "asd", "qwe", "zxc"]};
        const response = await req.post("/bucket", invalidBucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".required should NOT have duplicate items (items ## 1 and 0 are identical)",
          "validation failed"
        ]);
      });
    });

    it("should show error about readonly type", async () => {
      const invalidBucket = {...validBucket, readOnly: "true"};
      const response = await req.post("/bucket", invalidBucket);
      expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
      expect([response.body.message, response.body.error]).toEqual([
        ".readOnly should be boolean",
        "validation failed"
      ]);
    });

    describe("properties", () => {
      it("should show error about type", async () => {
        const invalidBucket = {...validBucket, properties: 1};
        const response = await req.post("/bucket", invalidBucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".properties should be object",
          "validation failed"
        ]);
      });

      it("should show error about title type", async () => {
        const invalidBucket = JSON.parse(JSON.stringify(validBucket));
        invalidBucket.properties.title.type = 333;
        const response = await req.post("/bucket", invalidBucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".properties['title'].type should be string",
          "validation failed"
        ]);
      });

      it("should show error about title type which isnt available", async () => {
        const invalidBucket = JSON.parse(JSON.stringify(validBucket));
        invalidBucket.properties.title.type = "hashmap";
        const response = await req.post("/bucket", invalidBucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".properties['title'].type should be equal to one of the allowed values",
          "validation failed"
        ]);
      });

      it("should show error about title title", async () => {
        const invalidBucket = JSON.parse(JSON.stringify(validBucket));
        invalidBucket.properties.title.title = 333;
        const response = await req.post("/bucket", invalidBucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".properties['title'].title should be string",
          "validation failed"
        ]);
      });

      it("should show error about title description", async () => {
        const invalidBucket = JSON.parse(JSON.stringify(validBucket));
        invalidBucket.properties.title.description = ["asdqwe", "ahsgdasd"];
        const response = await req.post("/bucket", invalidBucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".properties['title'].description should be string",
          "validation failed"
        ]);
      });

      it("should show error about title options type", async () => {
        const invalidBucket = JSON.parse(JSON.stringify(validBucket));
        invalidBucket.properties.title.options = "asd";
        const response = await req.post("/bucket", invalidBucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".properties['title'].options should be object",
          "validation failed"
        ]);
      });

      it("should show error about title visible type", async () => {
        const invalidBucket = JSON.parse(JSON.stringify(validBucket));
        invalidBucket.properties.title.options.visible = "asd";
        const response = await req.post("/bucket", invalidBucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".properties['title'].options.visible should be boolean",
          "validation failed"
        ]);
      });

      it("should show error about title translate type", async () => {
        const invalidBucket = JSON.parse(JSON.stringify(validBucket));
        invalidBucket.properties.title.options.translate = 33;
        const response = await req.post("/bucket", invalidBucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".properties['title'].options.translate should be boolean",
          "validation failed"
        ]);
      });

      it("should show error about title history type", async () => {
        const invalidBucket = JSON.parse(JSON.stringify(validBucket));
        invalidBucket.properties.title.options.history = "false";
        const response = await req.post("/bucket", invalidBucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".properties['title'].options.history should be boolean",
          "validation failed"
        ]);
      });

      it("should show error about title position type", async () => {
        const invalidBucket = JSON.parse(JSON.stringify(validBucket));
        invalidBucket.properties.title.options.position = ["bottom,left"];
        const response = await req.post("/bucket", invalidBucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".properties['title'].options.position should be string",
          "validation failed"
        ]);
      });

      it("should show error about title position value which isn't available", async () => {
        const invalidBucket = JSON.parse(JSON.stringify(validBucket));
        invalidBucket.properties.title.options.position = "top";
        const response = await req.post("/bucket", invalidBucket);
        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect([response.body.message, response.body.error]).toEqual([
          ".properties['title'].options.position should be equal to one of the allowed values",
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
          type: "relation",
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
              options: {}
            },
            setting: {
              type: "relation",
              bucketId: settingsBucket._id,
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
      let deleteResponse = await req.delete(`/bucket/${usersBucket._id}`);
      expect([deleteResponse.statusCode, deleteResponse.statusText]).toEqual([204, "No Content"]);
      expect(deleteResponse.body).toEqual(undefined);

      let {body: usersBucketResponse} = await req.get(`/bucket/${usersBucket._id}`, {});
      expect(usersBucketResponse).toBeUndefined();

      let usersDocumentResponse = await req.get(`/bucket/${usersBucket._id}/data`, {});
      expect([usersDocumentResponse.statusCode, usersDocumentResponse.statusText]).toEqual([
        404,
        "Not Found"
      ]);

      let {body: scoresBucketResponse} = await req.get(`/bucket/${scoresBucket._id}`, {});
      expect(scoresBucketResponse.properties).toEqual({
        score: {
          type: "number",
          options: {}
        },
        setting: {
          type: "relation",
          bucketId: settingsBucket._id,
          options: {}
        }
      });

      let {body: scoresDocumentResponse} = await req.get(`/bucket/${scoresBucket._id}/data`, {});
      expect(scoresDocumentResponse).toEqual([
        {
          _id: score._id,
          score: 500,
          setting: setting._id
        }
      ]);
    });
  });
});
