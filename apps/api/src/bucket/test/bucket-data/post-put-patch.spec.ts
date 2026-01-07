import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {SchemaModule} from "@spica-server/core/schema";
import {CREATED_AT, UPDATED_AT} from "@spica-server/core/schema/defaults";
import {DATE_TIME, OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

describe("BucketDataController", () => {
  let app: INestApplication;
  let req: Request;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID, DATE_TIME, OBJECTID_STRING],
          defaults: [CREATED_AT, UPDATED_AT]
        }),
        CoreTestingModule,
        PassportTestingModule.initialize(),
        DatabaseTestingModule.standalone(),
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
    req.reject = true; /* Reject for non 2xx response codes */
    await app.listen(req.socket);
  });

  afterEach(() => app.close());

  describe("post,put,patch requests", () => {
    let myBucketId: string;
    beforeEach(async () => {
      const myBucket = {
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
      const {body} = await req.post("/bucket", myBucket);
      myBucketId = body._id;
    });

    describe("post", () => {
      it("should insert document to bucket and return inserted document", async () => {
        const insertedDocument = (
          await req.post(`/bucket/${myBucketId}/data`, {
            title: "first title",
            description: "first description"
          })
        ).body;

        const bucketDocument = (
          await req.get(`/bucket/${myBucketId}/data/${insertedDocument._id}`, {})
        ).body;

        expect(bucketDocument).toEqual(insertedDocument);

        delete insertedDocument._id;
        expect(insertedDocument).toEqual({title: "first title", description: "first description"});
      });

      it("should insert document with id", async () => {
        const _id = new ObjectId();
        const insertedDocument = (
          await req.post(`/bucket/${myBucketId}/data`, {
            _id: _id,
            title: "first title",
            description: "first description"
          })
        ).body;

        const bucketDocument = (await req.get(`/bucket/${myBucketId}/data/${_id}`, {})).body;

        expect(bucketDocument).toEqual(insertedDocument);
        expect(insertedDocument).toEqual({
          _id: _id.toHexString(),
          title: "first title",
          description: "first description"
        });
      });

      it("should return error if id is not valid", async () => {
        const _id = "invalid_objectid";

        const response = await req
          .post(`/bucket/${myBucketId}/data`, {
            _id: _id,
            title: "title",
            description: "description"
          })
          .catch(e => e);
        expect(response.statusCode).toBe(400);
        expect(response.statusText).toBe("Bad Request");
        expect(response.body).toEqual({
          statusCode: 400,
          message: '._id should match format "objectid"',
          error: "validation failed"
        });
      });

      it("should return error if id has already exist", async () => {
        const existingId = await req
          .post(`/bucket/${myBucketId}/data`, {
            title: "title",
            description: "description"
          })
          .then(r => r.body._id);

        const response = await req
          .post(`/bucket/${myBucketId}/data`, {
            _id: existingId,
            title: "title2",
            description: "description2"
          })
          .catch(e => e);
        expect(response.statusCode).toBe(400);
        expect(response.statusText).toBe("Bad Request");
        expect(response.body).toEqual({
          statusCode: 400,
          message: "Value of the property ._id should unique across all documents."
        });
      });

      it("should return error if title isnt valid for bucket", async () => {
        const response = await req
          .post(`/bucket/${myBucketId}/data`, {
            title: true,
            description: "description"
          })
          .then(() => null)
          .catch(e => e);
        expect(response.statusCode).toBe(400);
        expect(response.statusText).toBe("Bad Request");
        expect(response.body).toEqual({
          statusCode: 400,
          message: ".title must be string",
          error: "validation failed"
        });
      });
    });

    describe("put/patch", () => {
      let insertedDocument;
      beforeEach(async () => {
        const {body} = await req.post(`/bucket/${myBucketId}/data`, {
          title: "first title",
          description: "first description"
        });
        insertedDocument = body;
      });

      it("should update document", async () => {
        const {body: updatedDocument} = await req.put(
          `/bucket/${myBucketId}/data/${insertedDocument._id}`,
          {
            ...insertedDocument,
            title: "updated title"
          }
        );
        const {body: bucketDocument} = await req.get(
          `/bucket/${myBucketId}/data/${updatedDocument._id}`
        );
        expect(bucketDocument).toEqual(updatedDocument);
        expect(updatedDocument).toEqual({
          _id: updatedDocument._id,
          title: "updated title",
          description: "first description"
        });
      });

      it("should patch document", async () => {
        const response = await req.patch(`/bucket/${myBucketId}/data/${insertedDocument._id}`, {
          title: "new_title",
          description: null
        });

        expect(response.statusCode).toEqual(200);
        expect(response.body).toEqual({_id: insertedDocument._id, title: "new_title"});
      });

      it("should throw error when patched document is not valid", async () => {
        const response = await req
          .patch(`/bucket/${myBucketId}/data/${insertedDocument._id}`, {
            title: 1001
          })
          .catch(e => e);

        expect(response.statusCode).toBe(400);
        expect(response.statusText).toBe("Bad Request");
        expect(response.body).toEqual({
          statusCode: 400,
          message: ".title must be string",
          error: "validation failed"
        });
      });

      it("should throw error when put document does not exist", async () => {
        const response = await req
          .patch(`/bucket/${myBucketId}/data/000000000000000000000000`, {
            title: null
          })
          .catch(e => e);

        expect(response.statusCode).toBe(404);
        expect(response.statusText).toBe("Not Found");
        expect(response.body).toEqual({
          statusCode: 404,
          message: `Could not find the document with id 000000000000000000000000`,
          error: "Not Found"
        });
      });

      it("should throw error when patched document does not exist", async () => {
        const response = await req
          .put(`/bucket/${myBucketId}/data/000000000000000000000000`, {
            title: "test"
          })
          .catch(e => e);

        expect(response.statusCode).toBe(404);
        expect(response.statusText).toBe("Not Found");
        expect(response.body).toEqual({
          statusCode: 404,
          message: `Could not find the document with id 000000000000000000000000`,
          error: "Not Found"
        });
      });
    });

    it("should return error if description isnt valid for bucket", async () => {
      const response = await req
        .post(`/bucket/${myBucketId}/data`, {
          title: "title",
          description: [1, 2, 3]
        })
        .catch(e => e);
      expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
      expect([response.body.error, response.body.message]).toEqual([
        "validation failed",
        ".description must be string"
      ]);
    });
  });
});
