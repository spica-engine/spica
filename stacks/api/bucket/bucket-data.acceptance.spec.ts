import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {Middlewares} from "@spica-server/core";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, DatabaseService} from "@spica-server/database/testing";
import * as BSON from "bson";
import {BucketModule} from "./bucket.module";
describe("Bucket-Data acceptance", () => {
  let app: INestApplication;
  let req: Request;
  let module;
  let myBucketId = new BSON.ObjectID("56cb91bdc3464f14678934ca");
  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [CoreTestingModule, DatabaseTestingModule.replicaSet(), BucketModule]
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
        await app
          .get(DatabaseService)
          .collection("buckets")
          .insertOne({
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
          });

        //insert some data
        const bucketdata = new Array(20).fill(undefined).map((_, index) => {
          return {title: `new title${index + 1}`, description: `new description${index + 1}`};
        });
        await app
          .get(DatabaseService)
          .collection("bucket_56cb91bdc3464f14678934ca")
          .insertMany(bucketdata);
      });

      afterAll(async () => {
        await app
          .get(DatabaseService)
          .collection("buckets")
          .deleteOne({_id: myBucketId});
        await app.get(DatabaseService).dropCollection("bucket_56cb91bdc3464f14678934ca");
      });

      it("should work for any query", async () => {
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
        await app
          .get(DatabaseService)
          .collection("buckets")
          .insertOne({
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
          });

        //insert some data
        const bucketdata = new Array(5).fill(undefined).map((_, index) => {
          return {title: `new title${index + 1}`, description: `new description${5 - index}`};
        });
        await app
          .get(DatabaseService)
          .collection("bucket_56cb91bdc3464f14678934ca")
          .insertMany(bucketdata);
      });

      afterAll(async () => {
        await app
          .get(DatabaseService)
          .collection("buckets")
          .deleteOne({_id: myBucketId});
        await app.get(DatabaseService).dropCollection("bucket_56cb91bdc3464f14678934ca");
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
        await app
          .get(DatabaseService)
          .collection("buckets")
          .insertOne({
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
          });

        //insert some data
        const bucketdata = new Array(100).fill(undefined).map((_, index) => {
          return {title: `new title${index + 1}`, description: `new description${index + 1}`};
        });
        await app
          .get(DatabaseService)
          .collection("bucket_56cb91bdc3464f14678934ca")
          .insertMany(bucketdata);
      });

      afterAll(async () => {
        await app
          .get(DatabaseService)
          .collection("buckets")
          .deleteOne({_id: myBucketId});
        await app.get(DatabaseService).dropCollection("bucket_56cb91bdc3464f14678934ca");
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
  });

  afterAll(async () => {
    await app.close();
  });
});
