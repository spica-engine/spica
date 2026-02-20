import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {SchemaModule} from "@spica-server/core/schema";
import {CREATED_AT, UPDATED_AT} from "@spica-server/core/schema/defaults";
import {DATE_TIME, OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {
  DatabaseService,
  DatabaseTestingModule,
  ProfilingLevel
} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

describe("BucketDataController profiler", () => {
  let app: INestApplication;
  let req: Request;
  let module: TestingModule;
  let db: DatabaseService;

  const bucket1 = {
    _id: "6824a87e86e3700817eadc77",
    title: "new bucket",
    description: "new bucket",
    indexes: [],
    properties: {
      name: {
        type: "string",
        options: {
          position: "right"
        }
      }
    }
  };
  const bucket2 = {
    _id: "6824a894faa1408d00875d80",
    title: "new bucket 2",
    description: "new bucket 2",
    indexes: [],
    properties: {
      name: {
        type: "string",
        options: {
          position: "right"
        }
      }
    }
  };

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

    db = module.get(DatabaseService);
    await db.setProfilingLevel(ProfilingLevel.all);

    req = module.get(Request);
    await app.listen(req.socket);
  });

  afterEach(() => app.close());

  describe("profiler", () => {
    beforeEach(async () => {
      await Promise.all([req.post("/bucket", bucket1), req.post("/bucket", bucket2)]);

      // to make db insert profile entries
      await Promise.all([
        req.post(`/bucket/${bucket1._id}/data`, {name: "Hello"}),
        req.get(`/bucket/${bucket1._id}/data`),
        req.post(`/bucket/${bucket2._id}/data`, {name: "Hi"}),
        req.get(`/bucket/${bucket2._id}/data`)
      ]);
    });

    it("should list bucket1 data profile entries", async () => {
      const res = await req.get(`/bucket/${bucket1._id}/data/profile`);
      expect(res.statusCode).toEqual(200);
      expect(
        res.body.every(profileEntry => profileEntry.ns.endsWith(`.bucket_${bucket1._id}`))
      ).toEqual(true);
    });

    it("should list bucket2 data profile entries", async () => {
      const res = await req.get(`/bucket/${bucket2._id}/data/profile`);
      expect(res.statusCode).toEqual(200);
      expect(
        res.body.every(profileEntry => profileEntry.ns.endsWith(`.bucket_${bucket2._id}`))
      ).toEqual(true);
    });

    it("should filter bucket1 profile entries by operation type", async () => {
      const res = await req.get(`/bucket/${bucket1._id}/data/profile`, {
        filter: JSON.stringify({op: "insert"})
      });
      expect(res.statusCode).toEqual(200);
      expect(
        res.body.every(profileEntry => profileEntry.ns.endsWith(`.bucket_${bucket1._id}`))
      ).toEqual(true);
      expect(res.body.every(profileEntry => profileEntry.op == "insert")).toEqual(true);
    });

    it("should limit bucket1 profile entries", async () => {
      const res = await req.get(`/bucket/${bucket1._id}/data/profile`, {
        limit: 1
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body.length).toEqual(1);
      expect(
        res.body.every(profileEntry => profileEntry.ns.endsWith(`.bucket_${bucket1._id}`))
      ).toEqual(true);
    });

    it("should skip bucket1 profile entries", async () => {
      const [{body: allProfileEntries}, skippedRes] = await Promise.all([
        req.get(`/bucket/${bucket1._id}/data/profile`, {limit: 2, sort: JSON.stringify({_id: 1})}),
        req.get(`/bucket/${bucket1._id}/data/profile`, {
          skip: 1,
          limit: 1,
          sort: JSON.stringify({_id: 1})
        })
      ]);
      expect(skippedRes.statusCode).toEqual(200);
      expect(skippedRes.body.length).toEqual(1);
      expect(skippedRes.body[0]._id).toEqual(allProfileEntries[1]._id);
      expect(
        skippedRes.body.every(profileEntry => profileEntry.ns.endsWith(`.bucket_${bucket1._id}`))
      ).toEqual(true);
    });

    it("should sort bucket1 profile entries", async () => {
      const res = await req.get(`/bucket/${bucket1._id}/data/profile`, {
        sort: JSON.stringify({ts: -1})
      });
      expect(res.statusCode).toEqual(200);

      for (let i = 1; i < res.body.length; i++) {
        expect(res.body[i - 1].ts >= res.body[i].ts).toEqual(true);
      }

      expect(
        res.body.every(profileEntry => profileEntry.ns.endsWith(`.bucket_${bucket1._id}`))
      ).toEqual(true);
    });

    // to prevent accessing other collections profile entries
    it("should ignore ns on filter", async () => {
      const res = await req.get(`/bucket/${bucket1._id}/data/profile`, {
        filter: JSON.stringify({ns: "test.buckets"})
      });

      expect(res.statusCode).toEqual(200);
      // user provided ns filter will be overridden
      expect(
        res.body.every(profileEntry => profileEntry.ns.endsWith(`.bucket_${bucket1._id}`))
      ).toEqual(true);
    });

    it("should ignore ns on the nested filter", async () => {
      const dbName = db.databaseName;
      const res = await req.get(`/bucket/${bucket1._id}/data/profile`, {
        filter: JSON.stringify({
          $or: [{ns: `${dbName}.bucket_${bucket2._id}`}, {ns: `${dbName}.buckets`}]
        })
      });

      expect(res.statusCode).toEqual(200);
      // there is no such profile entries for the filter below combined with the forced ns:
      /*
        {
          $or: [{ns: "<db>.bucket_<bucket2Id>"}, {ns: "<db>.buckets"}],
          "ns": "<db>.bucket_<bucket1Id>"
        }
      */
      expect(res.body.length).toEqual(0);
    });
  });
});
