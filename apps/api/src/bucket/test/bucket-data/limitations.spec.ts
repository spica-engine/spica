import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {SchemaModule} from "@spica-server/core/schema";
import {CREATED_AT, UPDATED_AT} from "@spica-server/core/schema/defaults";
import {DATE_TIME, OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
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
    req.reject = true; /* Reject for non 2xx response codes */
    await app.listen(req.socket);
  });

  afterEach(() => app.close());

  describe("insert with limitations", () => {
    describe("prevent inserting", () => {
      let bucketId: string;
      let bucket;
      beforeEach(async () => {
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
          },
          documentSettings: {
            countLimit: 1,
            limitExceedBehaviour: "prevent"
          }
        };
        const {body} = await req.post("/bucket", bucket);
        bucketId = body._id;
      });

      it("should throw error and prevent inserting when limit reached", async () => {
        const {body: document1} = await req.post(`/bucket/${bucketId}/data`, {
          title: "first title",
          description: "first description"
        });

        expect(document1).toEqual({
          _id: document1._id,
          title: "first title",
          description: "first description"
        });

        const response = await req
          .post(`/bucket/${bucketId}/data`, {
            title: "second title",
            description: "second description"
          })
          .catch(e => e);

        expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
        expect(response.body.message).toEqual(
          "Database error: Maximum number of documents has been reached"
        );
      });

      it("should disable document count limitation", async () => {
        delete bucket.documentSettings;
        await req.put(`/bucket/${bucketId}`, bucket);

        const {body: document1} = await req.post(`/bucket/${bucketId}/data`, {
          title: "first title",
          description: "first description"
        });

        expect(document1).toEqual({
          _id: document1._id,
          title: "first title",
          description: "first description"
        });

        const {body: document2} = await req.post(`/bucket/${bucketId}/data`, {
          title: "second title",
          description: "second description"
        });

        expect(document2).toEqual({
          _id: document2._id,
          title: "second title",
          description: "second description"
        });
      });
    });

    describe("insert and remove oldest document", () => {
      let bucketId: string;
      let bucket;
      beforeEach(async () => {
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
          },
          documentSettings: {
            countLimit: 1,
            limitExceedBehaviour: "remove"
          }
        };
        const {body} = await req.post("/bucket", bucket);
        bucketId = body._id;
      });

      it("should insert document but remove the oldest document of bucket", async () => {
        const {body: document1} = await req.post(`/bucket/${bucketId}/data`, {
          title: "first title",
          description: "first description"
        });

        expect(document1).toEqual({
          _id: document1._id,
          title: "first title",
          description: "first description"
        });

        const {body: document2} = await req.post(`/bucket/${bucketId}/data`, {
          title: "second title",
          description: "second description"
        });

        expect(document2).toEqual({
          _id: document2._id,
          title: "second title",
          description: "second description"
        });

        const {body: documents} = await req.get(`/bucket/${bucketId}/data`);
        expect(documents).toEqual([
          {
            _id: documents[0]._id,
            title: "second title",
            description: "second description"
          }
        ]);
      });

      it("should disable document count limitation", async () => {
        delete bucket.documentSettings;
        await req.put(`/bucket/${bucketId}`, bucket);

        const {body: document1} = await req.post(`/bucket/${bucketId}/data`, {
          title: "first title",
          description: "first description"
        });

        expect(document1).toEqual({
          _id: document1._id,
          title: "first title",
          description: "first description"
        });

        const {body: document2} = await req.post(`/bucket/${bucketId}/data`, {
          title: "second title",
          description: "second description"
        });

        expect(document2).toEqual({
          _id: document2._id,
          title: "second title",
          description: "second description"
        });

        const {body: documents} = await req.get(`/bucket/${bucketId}/data`);
        expect(documents).toEqual([
          {
            _id: documents[0]._id,
            title: "first title",
            description: "first description"
          },
          {
            _id: documents[1]._id,
            title: "second title",
            description: "second description"
          }
        ]);
      });
    });
  });
});
