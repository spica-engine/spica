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

  describe("unique fields", () => {
    let bucket;
    beforeEach(async () => {
      const body = {
        title: "new bucket",
        description: "new bucket",
        properties: {
          title: {
            type: "string",
            options: {
              position: "right",
              unique: true
            }
          },
          description: {
            type: "string",
            options: {
              position: "right"
            }
          }
        }
      };

      bucket = await req.post("/bucket", body).then(r => r.body);
    });

    it("should insert documents when they have unique values", async () => {
      let document = {
        title: "Rat Of The Eternal",
        description: "Description of book"
      };

      let response = await req.post(`/bucket/${bucket._id}/data`, document);
      expect([response.statusCode, response.statusText]).toEqual([201, "Created"]);

      document.title = "Hawk Without Hate";

      response = await req.post(`/bucket/${bucket._id}/data`, document);
      expect([response.statusCode, response.statusText]).toEqual([201, "Created"]);
    });

    it("should update document when updated one have unique value", async () => {
      let document = {
        _id: undefined,
        title: "Men Without Faith",
        description: "Description of book"
      };

      let response = await req.post(`/bucket/${bucket._id}/data`, document).then(res => {
        document = res.body;
        return res;
      });
      expect([response.statusCode, response.statusText]).toEqual([201, "Created"]);

      document.title = "Creators Of The Day";

      response = await req.put(`/bucket/${bucket._id}/data/${document._id}`, document);
      expect([response.statusCode, response.statusText]).toEqual([200, "OK"]);
    });

    it("should not update document when updated one does not have unique value", async () => {
      const document = {
        title: "Fish And Companions",
        description: "Description of book"
      };

      let document2 = {
        _id: undefined,
        title: "Mice And Enemies",
        description: "Description of book"
      };

      await req.post(`/bucket/${bucket._id}/data`, document);
      document2 = await req.post(`/bucket/${bucket._id}/data`, document2).then(r => r.body);

      document2.title = "Fish And Companions";

      const response = await req
        .put(`/bucket/${bucket._id}/data/${document2._id}`, document2)
        .catch(e => e);

      expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
      expect(response.body.message).toEqual(
        "Value of the property .title should unique across all documents."
      );
    });

    it("should not insert documents when they do not have unique values", async () => {
      const document = {
        title: "Mice And Enemies",
        description: "Description of book"
      };

      await req.post(`/bucket/${bucket._id}/data`, document);

      const response = await req.post(`/bucket/${bucket._id}/data`, document).catch(e => e);

      expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
      expect(response.body.message).toEqual(
        "Value of the property .title should unique across all documents."
      );
    });
  });
});
