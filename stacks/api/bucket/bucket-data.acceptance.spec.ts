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
            age: {
              type: "number",
              title: "description",
              description: "Description of the row",
              options: {position: "right"}
            }
          }
        };
        await req.post("/bucket", myBucket);

        //insert some data
        const bucketdata = [
          {title: "title starts with a", age: 15},
          {title: "title starts with b", age: 10},
          {title: "title starts with c", age: 5}
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
      });

      it("ascend by age", async () => {
        const response = await req.get(`/bucket/${myBucketId}/data`, {
          sort: JSON.stringify({age: 1})
        });

        const objects = response.body;
        expect(objects.length).toBe(3);

        expect(objects.map(element => element.age)).toEqual([5, 10, 15]);
      });

      it("descend by age", async () => {
        const response = await req.get(`/bucket/${myBucketId}/data`, {
          sort: JSON.stringify({age: -1})
        });

        const objects = response.body;
        expect(objects.length).toBe(3);

        expect(objects.map(element => element.age)).toEqual([15, 10, 5]);
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
  });

  afterAll(async () => {
    await app.close();
  });
});
