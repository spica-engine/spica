import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "../..";
import {SchemaModule} from "../../../../../../libs/core/schema";
import {CREATED_AT, UPDATED_AT} from "../../../../../../libs/core/schema/defaults";
import {DATE_TIME, OBJECTID_STRING, OBJECT_ID} from "../../../../../../libs/core/schema/formats";
import {CoreTestingModule, Request} from "../../../../../../libs/core/testing";
import {DatabaseTestingModule} from "../../../../../../libs/database/testing";
import {PassportTestingModule} from "../../../passport/testing";
import {PreferenceTestingModule} from "../../../preference/testing";

describe("BucketDataController json field", () => {
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
  describe("json field type", () => {
    let bucket;
    let rows;

    beforeEach(async () => {
      const body = {
        title: "new bucket",
        description: "new bucket",
        properties: {
          name: {
            type: "string",
            options: {
              position: "right"
            }
          },
          characteristics: {
            type: "json",
            options: {
              position: "right"
            }
          }
        }
      };

      bucket = await req.post("/bucket", body).then(r => r.body);

      rows = [
        await req.post(`/bucket/${bucket._id}/data`, {
          name: "James",
          characteristics: {height: 184, weight: "75kg"}
        }),
        await req.post(`/bucket/${bucket._id}/data`, {
          name: "Braim",
          characteristics: {height: 170, weight: "70kg"}
        })
      ].map(r => r.body);
    });

    afterEach(async () => {
      await req.delete(`/bucket/${bucket._id}`);
    });

    it("should get documents", async () => {
      const res = await req.get(`/bucket/${bucket._id}/data`);

      const {statusCode, statusText, body} = res;

      expect([statusCode, statusText]).toEqual([200, "OK"]);
      expect(body).toEqual(rows);
    });

    it("should insert new document", async () => {
      const newDocument = {
        name: "Modric",
        characteristics: {height: 174, weight: "74kg"}
      };

      const res = await req.post(`/bucket/${bucket._id}/data`, newDocument);
      expect([res.statusCode, res.statusText]).toEqual([201, "Created"]);

      const document = await req.get(`/bucket/${bucket._id}/data/${res.body._id}`);
      const {statusCode, statusText, body} = document;

      expect([statusCode, statusText]).toEqual([200, "OK"]);
      expect(body).toEqual({...newDocument, _id: res.body._id});
    });

    it("should update document", async () => {
      await req.patch(`/bucket/${bucket._id}/data/${rows[0]._id}`, {
        characteristics: {height: 200}
      });
      const document = await req.get(`/bucket/${bucket._id}/data/${rows[0]._id}`);

      const {statusCode, statusText, body} = document;

      expect([statusCode, statusText]).toEqual([200, "OK"]);
      expect(body).toEqual({
        ...rows[0],
        characteristics: {...rows[0].characteristics, height: 200}
      });
    });

    it("should replace document", async () => {
      const newDocument = {
        name: "James",
        characteristics: {height: 200, weight: "80kg"}
      };

      await req.put(`/bucket/${bucket._id}/data/${rows[0]._id}`, newDocument);
      const document = await req.get(`/bucket/${bucket._id}/data/${rows[0]._id}`);

      const {statusCode, statusText, body} = document;

      expect([statusCode, statusText]).toEqual([200, "OK"]);
      expect(body).toEqual({...newDocument, _id: rows[0]._id});
    });

    it("should filter documents based on multiple characteristics", async () => {
      const document = await req.get(`/bucket/${bucket._id}/data`, {
        filter: JSON.stringify({characteristics: {height: 170, weight: "70kg"}})
      });

      const {statusCode, statusText, body} = document;

      expect([statusCode, statusText]).toEqual([200, "OK"]);
      expect(body[0]).toEqual(rows[1]);
    });

    it("should filter documents based on a single characteristic", async () => {
      const document = await req.get(`/bucket/${bucket._id}/data`, {
        filter: JSON.stringify({"characteristics.height": {$eq: 184}})
      });

      const {statusCode, statusText, body} = document;

      expect([statusCode, statusText]).toEqual([200, "OK"]);
      expect(body[0]).toEqual(rows[0]);
    });
  });
});
