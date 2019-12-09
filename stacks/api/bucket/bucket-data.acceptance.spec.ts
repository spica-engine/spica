import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {Middlewares} from "@spica-server/core";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, DatabaseService} from "@spica-server/database/testing";
import * as BSON from "bson";
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
  let myBucketId = new BSON.ObjectID("56cb91bdc3464f14678934ca");
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
        const bucketdata = new Array(20).fill(undefined).map((_, index) => {
          return {title: `new title${index + 1}`, description: `new description${index + 1}`};
        });

        for (let i = 0; i < bucketdata.length; i++) {
          await req.post("/bucket/56cb91bdc3464f14678934ca/data", bucketdata[i]);
        }
      });

      afterAll(async () => {
        await app
          .get(DatabaseService)
          .collection("buckets")
          .deleteOne({_id: myBucketId})
          .catch();
        await app
          .get(DatabaseService)
          .collection("bucket_56cb91bdc3464f14678934ca")
          .deleteMany({})
          .catch();
      });

      it("should work without query", async () => {
        const response = await req.get(`/bucket/56cb91bdc3464f14678934ca/data`, {});
        expect(response.body.length).toEqual(20);
        response.body.forEach((val, index) => {
          expect(val.title).toBe(`new title${index + 1}`);
          expect(val.description).toBe(`new description${index + 1}`);
        });
      });

      it("should work with limit query", async () => {
        const response = await req.get(`/bucket/56cb91bdc3464f14678934ca/data`, {limit: "7"});
        expect(response.body.length).toEqual(7);
        response.body.forEach((val, index) => {
          expect(val.title).toBe(`new title${index + 1}`);
          expect(val.description).toBe(`new description${index + 1}`);
        });
      });

      it("should work with skip query", async () => {
        const response = await req.get(`/bucket/56cb91bdc3464f14678934ca/data`, {skip: "4"});
        expect(response.body.length).toEqual(16);
        response.body.forEach((val, index) => {
          expect(val.title).toBe(`new title${index + 4 + 1}`);
          expect(val.description).toBe(`new description${index + 4 + 1}`);
        });
      });

      it("should work with skip and limit query", async () => {
        const response = await req.get(`/bucket/56cb91bdc3464f14678934ca/data`, {
          limit: "15",
          skip: "2"
        });
        expect(response.body.length).toEqual(15);
        response.body.forEach((val, index) => {
          expect(val.title).toBe(`new title${index + 2 + 1}`);
          expect(val.description).toBe(`new description${index + 2 + 1}`);
        });
      });
    });

    describe("sorts", () => {
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
        const bucketdata = new Array(5).fill(undefined).map((_, index) => {
          return {title: `new title${index + 1}`, description: `new description${5 - index}`};
        });

        for (let i = 0; i < bucketdata.length; i++) {
          await req.post("/bucket/56cb91bdc3464f14678934ca/data", bucketdata[i]);
        }
      });

      afterAll(async () => {
        await app
          .get(DatabaseService)
          .collection("buckets")
          .deleteOne({_id: myBucketId})
          .catch();
        await app
          .get(DatabaseService)
          .collection("bucket_56cb91bdc3464f14678934ca")
          .deleteMany({})
          .catch();
      });

      it("ascend by title", async () => {
        const response = await req.get(`/bucket/56cb91bdc3464f14678934ca/data`, {
          sort: JSON.stringify({title: 1})
        });

        const objects = response.body;
        objects.forEach((val, index) => {
          expect(val.title).toBe(`new title${index + 1}`);
          expect(val.description).toBe(`new description${objects.length - index}`);
        });
      });
      it("descend by title", async () => {
        const response = await req.get(`/bucket/56cb91bdc3464f14678934ca/data`, {
          sort: JSON.stringify({title: -1})
        });

        const objects = response.body;
        objects.forEach((val, index) => {
          expect(val.title).toBe(`new title${objects.length - index}`);
          expect(val.description).toBe(`new description${index + 1}`);
        });
      });

      it("ascend by description", async () => {
        const response = await req.get(`/bucket/56cb91bdc3464f14678934ca/data`, {
          sort: JSON.stringify({description: 1})
        });

        const objects = response.body;
        objects.forEach((val, index) => {
          expect(val.title).toBe(`new title${objects.length - index}`);
          expect(val.description).toBe(`new description${index + 1}`);
        });
      });

      it("descend by description", async () => {
        const response = await req.get(`/bucket/56cb91bdc3464f14678934ca/data`, {
          sort: JSON.stringify({description: -1})
        });

        const objects = response.body;
        objects.forEach((val, index) => {
          expect(val.title).toBe(`new title${index + 1}`);
          expect(val.description).toBe(`new description${objects.length - index}`);
        });
      });
    });

    describe("pagination", () => {
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
        const bucketdata = new Array(100).fill(undefined).map((_, index) => {
          return {title: `new title${index + 1}`, description: `new description${index + 1}`};
        });

        for (let i = 0; i < bucketdata.length; i++) {
          await req.post("/bucket/56cb91bdc3464f14678934ca/data", bucketdata[i]);
        }
      });

      afterAll(async () => {
        await app
          .get(DatabaseService)
          .collection("buckets")
          .deleteOne({_id: myBucketId})
          .catch();
        await app
          .get(DatabaseService)
          .collection("bucket_56cb91bdc3464f14678934ca")
          .deleteMany({})
          .catch();
      });

      it("single paginate param", async () => {
        const response = await req.get(`/bucket/56cb91bdc3464f14678934ca/data`, {paginate: "true"});
        expect(response.body.meta.total).toBe(100);
        expect(response.body.data.length).toBe(100);
      });

      it("paginate with limit", async () => {
        const response = await req.get(`/bucket/56cb91bdc3464f14678934ca/data`, {
          limit: "20",
          paginate: "true"
        });
        expect(response.body.meta.total).toBe(100);

        const objects = response.body.data;
        expect(objects.length).toBe(20);

        objects.forEach((val, index) => {
          expect(val.title).toBe(`new title${index + 1}`);
          expect(val.description).toBe(`new description${index + 1}`);
        });
      });

      it("paginate with skip", async () => {
        const response = await req.get(`/bucket/56cb91bdc3464f14678934ca/data`, {
          skip: "20",
          paginate: "true"
        });
        expect(response.body.meta.total).toBe(100);

        const objects = response.body.data;
        expect(objects.length).toBe(80);

        objects.forEach((val, index) => {
          expect(val.title).toBe(`new title${index + 20 + 1}`);
          expect(val.description).toBe(`new description${index + 20 + 1}`);
        });
      });

      it("paginate with limit and skip", async () => {
        const response = await req.get(`/bucket/56cb91bdc3464f14678934ca/data`, {
          limit: "50",
          skip: "10",
          paginate: "true"
        });
        expect(response.body.meta.total).toBe(100);

        const objects = response.body.data;
        expect(objects.length).toBe(50);

        objects.forEach((val, index) => {
          expect(val.title).toBe(`new title${index + 10 + 1}`);
          expect(val.description).toBe(`new description${index + 10 + 1}`);
        });
      });
    });

    describe("filter", () => {
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
        const bucketdata = new Array(10).fill(undefined).map((_, index) => {
          return {title: `new title${index + 1}`, description: `new description${index + 1}`};
        });

        for (let i = 0; i < bucketdata.length; i++) {
          await req.post("/bucket/56cb91bdc3464f14678934ca/data", bucketdata[i]);
        }
      });

      afterAll(async () => {
        await app
          .get(DatabaseService)
          .collection("buckets")
          .deleteOne({_id: myBucketId})
          .catch();
        await app
          .get(DatabaseService)
          .collection("bucket_56cb91bdc3464f14678934ca")
          .deleteMany({})
          .catch();
      });

      it("should filter data which has '1'", async () => {
        const response = await req.get(`/bucket/56cb91bdc3464f14678934ca/data`, {
          filter: JSON.stringify({title: {$regex: "1"}})
        });

        const objects = response.body;

        expect(objects.length).toBe(2);
        expect(
          objects.map((val, index) => {
            return val.title;
          })
        ).toEqual(["new title1", "new title10"]);
      });

      it("filter with pagination", async () => {
        const response = await req.get(`/bucket/56cb91bdc3464f14678934ca/data`, {
          paginate: "true",
          filter: JSON.stringify({title: {$regex: "1"}})
        });

        expect(response.body.meta.total).toBe(2);

        const objects = response.body.data;
        expect(objects.length).toBe(2);
        expect(
          objects.map((val, index) => {
            return val.title;
          })
        ).toEqual(["new title1", "new title10"]);
      });
    });

    xdescribe("localize", () => {
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

        const myTranslatableData = [
          {
            title: JSON.stringify({en_US: "something", tr_TR: "birşeyler"}),
            description: "description"
          },
          {
            title: JSON.stringify({en_US: "something new", tr_TR: "yeni birşeyler"}),
            description: "description"
          },
          {
            title: JSON.stringify({en_US: "something only english"}),
            description: "description"
          }
        ];
        for (let i = 0; i < myTranslatableData.length; i++) {
          await req.post("/bucket/56cb91bdc3464f14678934ca/data", myTranslatableData[i]);
        }
      });

      afterAll(async () => {
        await app
          .get(DatabaseService)
          .collection("buckets")
          .deleteOne({_id: myBucketId})
          .catch();
        await app
          .get(DatabaseService)
          .collection("bucket_56cb91bdc3464f14678934ca")
          .deleteMany({})
          .catch();
      });

      it("it should show data which is translated to english", async () => {
        const data = (await req.get(
          "/bucket/56cb91bdc3464f14678934ca/data",
          {translate: "true"},
          {"accept-language": "en_US"}
        )).body;

        expect(data.length).toBe(3);
        expect(data[0].title).toBe("something");
        expect(data[1].title).toBe("something new");
        expect(data[2].title).toBe("something only english");
      });

      it("it should show data which is translated to turkish", async () => {
        const data = (await req.get(
          "/bucket/56cb91bdc3464f14678934ca/data",
          {translate: "true"},
          {"accept-language": "tr_TR"}
        )).body;

        expect(data.length).toBe(3);
        expect(data[0].title).toBe("birşeyler");
        expect(data[1].title).toBe("yeni birşeyler");
        expect(data[2].title).toBe(
          "something only english",
          "it should work if there is only english data and english is default"
        );
      });
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
