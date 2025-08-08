import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "../..";
import {SchemaModule} from "../../../../../../libs/core/schema";
import {CREATED_AT, UPDATED_AT} from "../../../../../../libs/core/schema/defaults";
import {DATE_TIME, OBJECTID_STRING, OBJECT_ID} from "../../../../../../libs/core/schema/formats";
import {CoreTestingModule, Request} from "../../../../../../libs/core/testing";
import {DatabaseTestingModule, ObjectId} from "../../../../../../libs/database/testing";
import {PassportTestingModule} from "../../../passport/testing";
import {PreferenceTestingModule} from "../../../preference/testing";

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

  describe("delete requests", () => {
    let myBucketId: ObjectId;
    let myBucketData;

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
      myBucketId = new ObjectId((await req.post("/bucket", myBucket)).body._id);
      myBucketData = [
        {title: "first title", description: "first description"},
        {title: "last title", description: "last description"}
      ];

      //add data
      myBucketData[0]._id = new ObjectId(
        (await req.post(`/bucket/${myBucketId}/data`, myBucketData[0])).body._id
      );
      myBucketData[1]._id = new ObjectId(
        (await req.post(`/bucket/${myBucketId}/data`, myBucketData[1])).body._id
      );
    });

    it("should delete document", async () => {
      const response = await req.delete(`/bucket/${myBucketId}/data/${myBucketData[1]._id}`);
      expect(response.statusCode).toBe(204);
      expect(response.body).toBe(undefined);

      const bucketData = (await req.get(`/bucket/${myBucketId}/data`, {})).body;

      expect(bucketData.length).toBe(1);
      expect(bucketData[0].title).toBe("first title");
      expect(bucketData[0].description).toBe("first description");
    });

    it("should throw error when document does not exist", async () => {
      const response = await req
        .delete(`/bucket/${myBucketId}/data/000000000000000000000000`)
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
});
