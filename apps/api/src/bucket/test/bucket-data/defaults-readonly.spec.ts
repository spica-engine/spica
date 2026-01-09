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

  describe("defaults and readonly", () => {
    let bucketId: string;

    beforeEach(async () => {
      const myBucket = {
        title: "New Bucket",
        description: "Describe your new bucket",
        icon: "view_stream",
        readOnly: false,
        properties: {
          //this value is the value of the field on document, if it is not specified, default value will be used.
          created_at: {
            type: "date",
            default: ":created_at"
          },
          //this value always the create date of document. Value of the field on document will be ignored.
          created_at_readonly: {
            type: "date",
            default: ":created_at",
            readOnly: true
          }
        }
      };
      bucketId = (await req.post("/bucket", myBucket)).body._id;
    });

    it("should work with default and readonly values", async () => {
      const date = new Date("1980-01-01");
      let document = {
        created_at: date,
        created_at_readonly: date
      };
      const insertedDocument = (await req.post(`/bucket/${bucketId}/data`, document)).body;

      expect(new Date(insertedDocument.created_at)).toEqual(date);
      expect(new Date(insertedDocument.created_at_readonly)).not.toEqual(date);
    });

    it("should put default values if field does not exist on document", async () => {
      const insertedDocument = (await req.post(`/bucket/${bucketId}/data`)).body;

      expect(new Date(insertedDocument.created_at)).toEqual(expect.any(Date));
      expect(new Date(insertedDocument.created_at_readonly)).toEqual(expect.any(Date));
    });
  });
});
