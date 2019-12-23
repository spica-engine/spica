import {INestApplication} from "@nestjs/common";
import {SchemaModule, Default, Format} from "@spica-server/core/schema";
import {ObjectId, DatabaseService} from "@spica-server/database";
import {Test, TestingModule} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {BucketModule, Bucket} from ".";

export const CREATED_AT: Default = {
  keyword: ":created_at",
  type: "date",
  create: data => {
    return data || new Date().toISOString();
  }
};

export const UPDATED_AT: Default = {
  keyword: ":updated_at",
  type: "date",
  create: () => {
    return new Date().toISOString();
  }
};

export const OBJECT_ID: Format = {
  name: "objectid",
  type: "string",
  coerce: bucketId => {
    return new ObjectId(bucketId);
  },
  validate: bucketId => {
    try {
      return !!bucketId && !!new ObjectId(bucketId);
    } catch {
      return false;
    }
  }
};

describe("Bucket-Data acceptance", () => {
  let app: INestApplication;
  let req: Request;
  let module: TestingModule;

  const bucket = {
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

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID],
          defaults: [CREATED_AT, UPDATED_AT]
        }),
        CoreTestingModule,
        PassportTestingModule.initialize(),
        DatabaseTestingModule.replicaSet(),
        BucketModule
      ]
    }).compile();
    app = module.createNestApplication();
    req = module.get(Request);
    await app.listen(req.socket);
  }, 35000);

  afterEach(async () => {
    await module
      .get(DatabaseService)
      .collection("buckets")
      .deleteMany({})
      .catch();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("get requests", () => {
    it("should get predefinedDefaults", async () => {
      const response = await req.get("/bucket/predefs", {});
      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);

      const defaults = response.body;
      expect(defaults.length).toBe(2);
      expect(defaults).toEqual([
        {keyword: ":created_at", type: "date"},
        {keyword: ":updated_at", type: "date"}
      ]);
    });

    it("should get spesific bucket", async () => {
      //add bucket
      await req.post("/bucket", bucket);

      //get bucket
      const response = await req.get(`/bucket/${bucket._id}`, {});
      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
      expect(response.body).toEqual({
        _id: bucket._id.toHexString(),
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
      });
    });

    it("should get all buckets", async () => {
      //add buckets
      const firstBucket = {
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
            type: "string",
            title: "description",
            description: "Description of the row",
            options: {position: "right", visible: true}
          }
        }
      };
      const secondBucket = {
        _id: new ObjectId(),
        title: "New Bucket",
        description: "Describe your new bucket",
        icon: "view_stream",
        primary: "title",
        readOnly: false,
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
      };
      await req.post("/bucket", firstBucket);
      await req.post("/bucket", secondBucket);

      const response = await req.get("/bucket", {});
      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);

      const buckets = response.body;
      expect(buckets.length).toBe(2);
      expect(buckets).toEqual([
        {
          _id: firstBucket._id.toHexString(),
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
              type: "string",
              title: "description",
              description: "Description of the row",
              options: {position: "right", visible: true}
            }
          }
        },
        {
          _id: secondBucket._id.toHexString(),
          title: "New Bucket",
          description: "Describe your new bucket",
          icon: "view_stream",
          primary: "title",
          readOnly: false,
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
        }
      ]);
    });
  });

  describe("add/update requests", () => {
    it("should add new bucket and return it", async () => {
      const response = await req.post("/bucket", bucket);
      expect([response.statusCode, response.statusText]).toEqual([201, "Created"]);

      expect(response.body).toEqual({
        _id: bucket._id.toHexString(),
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
      });

      //check db
      const buckets = (await req.get("/bucket", {})).body;
      expect(buckets.length).toBe(1);
      expect(buckets[0]).toEqual({
        _id: bucket._id.toHexString(),
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
      });
    });

    it("should update single bucket", async () => {
      // add bucket
      let updatedBucket = (await req.post("/bucket", bucket)).body;

      //update bucket
      updatedBucket = {
        _id: bucket._id,
        title: "New Bucket",
        description: "Describe your new bucket",
        icon: "view_stream",
        primary: "description",
        readOnly: false,
        properties: {
          title: {
            type: "string",
            title: "title",
            description: "Title of the row",
            options: {position: "left"}
          },
          description: {
            type: "string",
            title: "description",
            description: "Description of the row",
            options: {position: "left", visible: true}
          },
          age: {
            type: "number",
            title: "age",
            description: "Age of the row",
            options: {position: "right", visible: true}
          }
        }
      };

      const response = await req.post("/bucket", updatedBucket);
      expect([response.statusCode, response.statusText]).toEqual([201, "Created"]);
      expect(response.body).toEqual({
        _id: bucket._id.toHexString(),
        title: "New Bucket",
        description: "Describe your new bucket",
        icon: "view_stream",
        primary: "description",
        readOnly: false,
        properties: {
          title: {
            type: "string",
            title: "title",
            description: "Title of the row",
            options: {position: "left"}
          },
          description: {
            type: "string",
            title: "description",
            description: "Description of the row",
            options: {position: "left", visible: true}
          },
          age: {
            type: "number",
            title: "age",
            description: "Age of the row",
            options: {position: "right", visible: true}
          }
        }
      });

      //check db
      const buckets = (await req.get("/bucket", {})).body;
      expect(buckets.length).toBe(1);
      expect(buckets[0]).toEqual({
        _id: bucket._id.toHexString(),
        title: "New Bucket",
        description: "Describe your new bucket",
        icon: "view_stream",
        primary: "description",
        readOnly: false,
        properties: {
          title: {
            type: "string",
            title: "title",
            description: "Title of the row",
            options: {position: "left"}
          },
          description: {
            type: "string",
            title: "description",
            description: "Description of the row",
            options: {position: "left", visible: true}
          },
          age: {
            type: "number",
            title: "age",
            description: "Age of the row",
            options: {position: "right", visible: true}
          }
        }
      });
    });

    it("should update multiple buckets with indexes", async () => {
      //add buckets
      let firstBucket: any = {
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
            type: "string",
            title: "description",
            description: "Description of the row",
            options: {position: "right", visible: true}
          }
        }
      };
      let secondBucket: any = {
        _id: new ObjectId(),
        title: "New Bucket",
        description: "Describe your new bucket",
        icon: "view_stream",
        primary: "title",
        readOnly: false,
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
      };
      await req.post("/bucket", firstBucket);
      await req.post("/bucket", secondBucket);

      //update buckets
      firstBucket = {
        _id: firstBucket._id,
        title: "Updated First Bucket",
        description: "Describe your new bucket",
        icon: "view_stream",
        primary: "description",
        readOnly: false,
        properties: {
          title: {
            type: "string",
            title: "title",
            description: "Title of the row",
            options: {position: "right", visible: true}
          },
          description: {
            type: "string",
            title: "description",
            description: "Description of the row",
            options: {position: "left", visible: true}
          }
        }
      };
      secondBucket = {
        _id: secondBucket._id,
        title: "Updated Second Bucket",
        description: "Describe your new bucket",
        icon: "view_stream",
        primary: "title",
        readOnly: false,
        properties: {
          newProp: {
            type: "boolean",
            title: "newProp",
            description: "newProp of the row",
            options: {position: "left", visible: true}
          },
          surname: {
            type: "string",
            title: "title",
            description: "Title of the row",
            options: {position: "left", visible: true}
          },
          lastname: {
            type: "number",
            title: "Age",
            description: "Age of the row",
            options: {position: "right", visible: true}
          }
        }
      };

      const response = await req.put("/bucket", [secondBucket, firstBucket]);
      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);

      const buckets = (await req.get("/bucket", {})).body;
      expect(buckets.length).toBe(2);
      expect(buckets).toEqual([
        {
          _id: firstBucket._id.toHexString(),
          title: "Updated First Bucket",
          description: "Describe your new bucket",
          icon: "view_stream",
          primary: "description",
          readOnly: false,
          properties: {
            title: {
              type: "string",
              title: "title",
              description: "Title of the row",
              options: {position: "right", visible: true}
            },
            description: {
              type: "string",
              title: "description",
              description: "Description of the row",
              options: {position: "left", visible: true}
            }
          },
          "[1]": firstBucket._id.toHexString()
        },
        {
          _id: secondBucket._id.toHexString(),
          title: "Updated Second Bucket",
          description: "Describe your new bucket",
          icon: "view_stream",
          primary: "title",
          readOnly: false,
          properties: {
            newProp: {
              type: "boolean",
              title: "newProp",
              description: "newProp of the row",
              options: {position: "left", visible: true}
            },
            surname: {
              type: "string",
              title: "title",
              description: "Title of the row",
              options: {position: "left", visible: true}
            },
            lastname: {
              type: "number",
              title: "Age",
              description: "Age of the row",
              options: {position: "right", visible: true}
            }
          },
          "[0]": secondBucket._id.toHexString()
        }
      ]);
    });
  });

  describe("delete requests", () => {
    it("should delete spesific bucket", async () => {
      const deletedBucketId = new ObjectId();
      //add buckets
      await req.post("/bucket", bucket);
      await req.post("/bucket", {...bucket, _id: deletedBucketId});

      const response = await req.delete(`/bucket/${deletedBucketId}`);
      expect([response.statusCode, response.statusText]).toEqual([204, "No Content"]);

      const buckets = (await req.get("/bucket", {})).body;
      expect(buckets.length).toBe(1);
      expect(buckets[0]).toEqual({
        _id: bucket._id.toHexString(),
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
      });
    });
  });
});
