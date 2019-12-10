import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {Middlewares} from "@spica-server/core";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, DatabaseService} from "@spica-server/database/testing";
import {BucketModule} from "./bucket.module";
import {SchemaModule} from "@spica-server/core/schema";
import {Default, Format} from "@spica-server/core/schema";
import {ObjectId} from "@spica-server/database";
import {PassportTestingModule} from "@spica-server/passport/testing";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;

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
  let module;
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
    app.use(Middlewares.BsonBodyParser);
    req = module.get(Request);
    await app.listen(req.socket);
  });

  describe("get requests", () => {
    describe("skip and limit", () => {
      let myBucketId = new ObjectId();
      beforeAll(async () => {
        //create bucket
        const myBucket = {
          _id: myBucketId,
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
        await req.post("/bucket", myBucket);

        //insert some data
        const bucketdata = [
          {title: "here is the title", description: "here is the description"},
          {title: "here is the another title", description: "here is the another description"},
          {title: "more title", description: "more description"},
          {title: "one more title", description: "one more description"},
          {title: "here is the last title", description: "here is the last description"}
        ];

        await req.post(`/bucket/${myBucketId}/data`, bucketdata[0]);
        await req.post(`/bucket/${myBucketId}/data`, bucketdata[1]);
        await req.post(`/bucket/${myBucketId}/data`, bucketdata[2]);
        await req.post(`/bucket/${myBucketId}/data`, bucketdata[3]);
        await req.post(`/bucket/${myBucketId}/data`, bucketdata[4]);
      });

      afterAll(async () => {
        await app
          .get(DatabaseService)
          .collection("buckets")
          .deleteOne({_id: myBucketId})
          .catch();
        await app
          .get(DatabaseService)
          .collection(`bucket_${myBucketId}`)
          .deleteMany({})
          .catch();
      });

      it("should work without query", async () => {
        const response = await req.get(`/bucket/${myBucketId}/data`, {});
        expect(response.body.length).toEqual(5);

        expect(response.body.map(element => element.title)).toEqual([
          "here is the title",
          "here is the another title",
          "more title",
          "one more title",
          "here is the last title"
        ]);
        expect(response.body.map(element => element.description)).toEqual([
          "here is the description",
          "here is the another description",
          "more description",
          "one more description",
          "here is the last description"
        ]);
      });

      it("should work with limit query", async () => {
        const response = await req.get(`/bucket/${myBucketId}/data`, {limit: "3"});
        expect(response.body.length).toEqual(3);
        expect(response.body.map(element => element.title)).toEqual([
          "here is the title",
          "here is the another title",
          "more title"
        ]);
        expect(response.body.map(element => element.description)).toEqual([
          "here is the description",
          "here is the another description",
          "more description"
        ]);
      });

      it("should work with skip query", async () => {
        const response = await req.get(`/bucket/${myBucketId}/data`, {skip: "2"});
        expect(response.body.length).toEqual(3);
        expect(response.body.map(element => element.title)).toEqual([
          "more title",
          "one more title",
          "here is the last title"
        ]);
        expect(response.body.map(element => element.description)).toEqual([
          "more description",
          "one more description",
          "here is the last description"
        ]);
      });

      it("should work with skip and limit query", async () => {
        const response = await req.get(`/bucket/${myBucketId}/data`, {
          limit: "2",
          skip: "1"
        });
        expect(response.body.length).toEqual(2);
        expect(response.body.map(element => element.title)).toEqual([
          "here is the another title",
          "more title"
        ]);
        expect(response.body.map(element => element.description)).toEqual([
          "here is the another description",
          "more description"
        ]);
      });
    });

    describe("sorts", () => {
      let myBucketId = new ObjectId();
      beforeAll(async () => {
        //create bucket
        const myBucket = {
          _id: myBucketId,
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
        await req.post("/bucket", myBucket);

        //insert some data
        const bucketdata = [
          {title: "title starts with a", description: "description starts with z"},
          {title: "title starts with b", description: "description starts with y"},
          {title: "title starts with c", description: "description starts with x"}
        ];

        await req.post(`/bucket/${myBucketId}/data`, bucketdata[0]);
        await req.post(`/bucket/${myBucketId}/data`, bucketdata[1]);
        await req.post(`/bucket/${myBucketId}/data`, bucketdata[2]);
      });

      afterAll(async () => {
        await app
          .get(DatabaseService)
          .collection("buckets")
          .deleteOne({_id: myBucketId})
          .catch();
        await app
          .get(DatabaseService)
          .collection(`bucket_${myBucketId}`)
          .deleteMany({})
          .catch();
      });

      it("ascend by title", async () => {
        const response = await req.get(`/bucket/${myBucketId}/data`, {
          sort: JSON.stringify({title: 1})
        });

        const objects = response.body;
        expect(objects.length).toBe(3);

        expect(objects.map(element => element.title)).toEqual([
          "title starts with a",
          "title starts with b",
          "title starts with c"
        ]);

        expect(objects.map(element => element.description)).toEqual([
          "description starts with z",
          "description starts with y",
          "description starts with x"
        ]);
      });
      it("descend by title", async () => {
        const response = await req.get(`/bucket/${myBucketId}/data`, {
          sort: JSON.stringify({title: -1})
        });

        const objects = response.body;
        expect(objects.length).toBe(3);

        expect(objects.map(element => element.title)).toEqual([
          "title starts with c",
          "title starts with b",
          "title starts with a"
        ]);

        expect(objects.map(element => element.description)).toEqual([
          "description starts with x",
          "description starts with y",
          "description starts with z"
        ]);
      });

      it("ascend by description", async () => {
        const response = await req.get(`/bucket/${myBucketId}/data`, {
          sort: JSON.stringify({description: 1})
        });

        const objects = response.body;
        expect(objects.length).toBe(3);

        expect(objects.map(element => element.title)).toEqual([
          "title starts with c",
          "title starts with b",
          "title starts with a"
        ]);

        expect(objects.map(element => element.description)).toEqual([
          "description starts with x",
          "description starts with y",
          "description starts with z"
        ]);
      });

      it("descend by description", async () => {
        const response = await req.get(`/bucket/${myBucketId}/data`, {
          sort: JSON.stringify({description: -1})
        });

        const objects = response.body;
        expect(objects.length).toBe(3);

        expect(objects.map(element => element.title)).toEqual([
          "title starts with a",
          "title starts with b",
          "title starts with c"
        ]);

        expect(objects.map(element => element.description)).toEqual([
          "description starts with z",
          "description starts with y",
          "description starts with x"
        ]);
      });
    });

    describe("pagination", () => {
      let myBucketId = new ObjectId();
      beforeAll(async () => {
        //create bucket
        const myBucket = {
          _id: myBucketId,
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
        await req.post("/bucket", myBucket);

        //insert some data
        const bucketdata = [
          {title: "here is the title", description: "here is the description"},
          {title: "here is the another title", description: "here is the another description"},
          {title: "more title", description: "more description"},
          {title: "one more title", description: "one more description"},
          {title: "here is the last title", description: "here is the last description"}
        ];

        await req.post(`/bucket/${myBucketId}/data`, bucketdata[0]);
        await req.post(`/bucket/${myBucketId}/data`, bucketdata[1]);
        await req.post(`/bucket/${myBucketId}/data`, bucketdata[2]);
        await req.post(`/bucket/${myBucketId}/data`, bucketdata[3]);
        await req.post(`/bucket/${myBucketId}/data`, bucketdata[4]);
      });

      afterAll(async () => {
        await app
          .get(DatabaseService)
          .collection("buckets")
          .deleteOne({_id: myBucketId})
          .catch();
        await app
          .get(DatabaseService)
          .collection(`bucket_${myBucketId}`)
          .deleteMany({})
          .catch();
      });

      it("single paginate param", async () => {
        const response = await req.get(`/bucket/${myBucketId}/data`, {paginate: "true"});
        expect(response.body.meta.total).toBe(5);
        expect(response.body.data.length).toBe(5);

        expect(response.body.data.map(element => element.title)).toEqual([
          "here is the title",
          "here is the another title",
          "more title",
          "one more title",
          "here is the last title"
        ]);
        expect(response.body.data.map(element => element.description)).toEqual([
          "here is the description",
          "here is the another description",
          "more description",
          "one more description",
          "here is the last description"
        ]);
      });

      it("paginate with limit", async () => {
        const response = await req.get(`/bucket/${myBucketId}/data`, {
          limit: "2",
          paginate: "true"
        });
        expect(response.body.meta.total).toBe(5);
        expect(response.body.data.length).toBe(2);

        expect(response.body.data.map(element => element.title)).toEqual([
          "here is the title",
          "here is the another title"
        ]);
        expect(response.body.data.map(element => element.description)).toEqual([
          "here is the description",
          "here is the another description"
        ]);
      });

      it("paginate with skip", async () => {
        const response = await req.get(`/bucket/${myBucketId}/data`, {
          skip: "3",
          paginate: "true"
        });
        expect(response.body.meta.total).toBe(5);
        expect(response.body.data.length).toBe(2);

        expect(response.body.data.map(element => element.title)).toEqual([
          "one more title",
          "here is the last title"
        ]);
        expect(response.body.data.map(element => element.description)).toEqual([
          "one more description",
          "here is the last description"
        ]);
      });

      it("paginate with limit and skip", async () => {
        const response = await req.get(`/bucket/${myBucketId}/data`, {
          limit: "3",
          skip: "2",
          paginate: "true"
        });
        expect(response.body.meta.total).toBe(5);
        expect(response.body.data.length).toBe(3);

        expect(response.body.data.map(element => element.title)).toEqual([
          "more title",
          "one more title",
          "here is the last title"
        ]);
        expect(response.body.data.map(element => element.description)).toEqual([
          "more description",
          "one more description",
          "here is the last description"
        ]);
      });
    });

    describe("filter", () => {
      let myBucketId = new ObjectId();
      beforeAll(async () => {
        //create bucket
        const myBucket = {
          _id: myBucketId,
          title: "New Bucket",
          description: "Describe your new bucket",
          icon: "view_stream",
          primary: "title",
          readOnly: false,
          properties: {
            name: {
              type: "string",
              title: "name",
              description: "Name of the row",
              options: {position: "left", visible: true}
            },
            age: {
              type: "number",
              title: "age",
              description: "Age of row",
              options: {position: "right"}
            }
          }
        };
        await req.post("/bucket", myBucket);

        //insert some data
        const bucketdata = [
          {name: "James", age: 23},
          {name: "John", age: 36},
          {name: "Smith", age: 44}
        ];
        await req.post(`/bucket/${myBucketId}/data`, bucketdata[0]);
        await req.post(`/bucket/${myBucketId}/data`, bucketdata[1]);
        await req.post(`/bucket/${myBucketId}/data`, bucketdata[2]);
      });

      afterAll(async () => {
        await app
          .get(DatabaseService)
          .collection("buckets")
          .deleteOne({_id: myBucketId})
          .catch();
        await app
          .get(DatabaseService)
          .collection(`bucket_${myBucketId}`)
          .deleteMany({})
          .catch();
      });

      it("should filter data which name contains 'J'", async () => {
        const response = await req.get(`/bucket/${myBucketId}/data`, {
          filter: JSON.stringify({name: {$regex: "J"}})
        });

        expect(response.body.length).toBe(2);
        expect(response.body.map(element => element.name)).toEqual(["James", "John"]);
      });

      it("should filter data which has name Smith", async () => {
        const response = await req.get(`/bucket/${myBucketId}/data`, {
          filter: JSON.stringify({name: "Smith"})
        });

        expect(response.body.length).toBe(1);
        expect(response.body[0].name).toBe("Smith");
      });

      it("should filter data which has age 36", async () => {
        const response = await req.get(`/bucket/${myBucketId}/data`, {
          filter: JSON.stringify({age: 36})
        });

        expect(response.body.length).toBe(1);
        expect(response.body[0].name).toBe("John");
      });

      it("should filter data which has age grater than or equal 36", async () => {
        const response = await req.get(`/bucket/${myBucketId}/data`, {
          filter: JSON.stringify({age: {$gte: 36}})
        });

        expect(response.body.length).toBe(2);
        expect(response.body.map(element => element.name)).toEqual(["John", "Smith"]);
      });

      it("should filter data which has age less than 25", async () => {
        const response = await req.get(`/bucket/${myBucketId}/data`, {
          filter: JSON.stringify({age: {$lt: 25}})
        });

        expect(response.body.length).toBe(1);
        expect(response.body[0].name).toBe("James");
      });
    });

    describe("localize", () => {
      let myBucketId = new ObjectId();

      beforeAll(async () => {
        const myBucket = {
          _id: myBucketId,
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
              options: {position: "left", translate: true, visible: true}
            },
            description: {
              type: "textarea",
              title: "description",
              description: "Description of the row",
              options: {position: "right"}
            }
          }
        };
        await req.post("/bucket", myBucket);

        //insert some data
        const myTranslatableData = [
          {
            title: {en_US: "english words", tr_TR: "türkçe kelimeler"},
            description: "description"
          },
          {
            title: {en_US: "new english words", tr_TR: "yeni türkçe kelimeler"},
            description: "description"
          },
          {
            title: {en_US: "only english words"},
            description: "description"
          }
        ];

        await req.post(`/bucket/${myBucketId}/data`, myTranslatableData[0]);
        await req.post(`/bucket/${myBucketId}/data`, myTranslatableData[1]);
        await req.post(`/bucket/${myBucketId}/data`, myTranslatableData[2]);
      });

      afterAll(async () => {
        await app
          .get(DatabaseService)
          .collection("buckets")
          .deleteOne({_id: myBucketId})
          .catch();
        await app
          .get(DatabaseService)
          .collection(`bucket_${myBucketId}`)
          .deleteMany({})
          .catch();
      });

      it("it should show data which is translated to english", async () => {
        const response = await req.get(
          `/bucket/${myBucketId}/data`,
          {translate: "true"},
          {"accept-language": "en_US"}
        );

        expect(response.body.length).toBe(3);

        expect(response.body.map(element => element.title)).toEqual([
          "english words",
          "new english words",
          "only english words"
        ]);
      });

      it("it should show data which is translated to turkish and if it doesnt exist, show data as default language", async () => {
        const response = await req.get(
          `/bucket/${myBucketId}/data`,
          {translate: "true"},
          {"accept-language": "tr_TR"}
        );

        expect(response.body.length).toBe(3);

        expect(response.body.map(element => element.title)).toEqual([
          "türkçe kelimeler",
          "yeni türkçe kelimeler",
          "only english words"
        ]);
      });
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
