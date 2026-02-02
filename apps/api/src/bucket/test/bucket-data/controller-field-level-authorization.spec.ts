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
        PassportTestingModule.initialize({
          overriddenStrategyType: "USER"
        }),
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

  describe("index", () => {
    let bucket: any = {
      title: "Persons",
      description: "Person bucket",
      icon: "view_stream",
      primary: "title",
      properties: {
        name: {
          type: "string",
          title: "Name of the person",
          options: {position: "left"},
          maxLength: 20,
          minLength: 3
        },
        age: {
          type: "number",
          title: "Age of the person",
          options: {position: "right"}
        },
        created_at: {
          type: "date",
          title: "Creation Timestamp",
          options: {position: "bottom"}
        }
      }
    };

    let rows = [];

    beforeEach(async () => {
      bucket = await req.post("/bucket", bucket).then(response => response.body);
      rows = [
        await req.post(`/bucket/${bucket._id}/data`, {name: "Jim", age: 20}),
        await req.post(`/bucket/${bucket._id}/data`, {name: "Michael", age: 22}),
        await req.post(`/bucket/${bucket._id}/data`, {name: "Kevin", age: 25}),
        await req.post(`/bucket/${bucket._id}/data`, {name: "Dwight", age: 38}),
        await req.post(`/bucket/${bucket._id}/data`, {name: "Toby", age: 30})
      ].map(r => r.body);
    });

    describe("Field level authorization", () => {
      describe("when name is hidden for noop", () => {
        beforeEach(async () => {
          bucket.properties.name.acl = "auth.identifier != 'noop'";
          await req
            .put(`/bucket/${bucket._id}`, bucket)
            .then(response => console.log(response.body));
        });

        it("shouldn't see name field", async () => {
          const response = await req.get(
            `/bucket/${bucket._id}/data`,
            {},
            {Authorization: "USER test"}
          );
          console.log(response.body);
          expect(response.body.length).toBe(5);
          response.body.forEach((item: any) => {
            expect(item).not.toHaveProperty("name");
            expect(item).toHaveProperty("age");
          });
        });
      });

      describe("when name is shown only if age > 24", () => {
        beforeEach(async () => {
          bucket.properties.name.acl = "document.age > 24";
          await req.put(`/bucket/${bucket._id}`, bucket);
        });

        it("should only show name if age > 24", async () => {
          const response = await req.get(
            `/bucket/${bucket._id}/data`,
            {},
            {
              Authorization: "USER test"
            }
          );

          expect(response.body.length).toBe(5);
          expect(response.body).toEqual([
            {_id: rows[0]._id, age: 20},
            {_id: rows[1]._id, age: 22},
            {_id: rows[2]._id, name: "Kevin", age: 25},
            {_id: rows[3]._id, name: "Dwight", age: 38},
            {_id: rows[4]._id, name: "Toby", age: 30}
          ]);
        });
      });
    });
  });
});
