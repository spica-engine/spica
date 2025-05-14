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
    properties: {
      name: {
        type: "string",
        options: {
          position: "right"
        }
      }
    }
  };

  let bucket1Namespace;
  let bucket2Namespace;

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
    //@ts-ignore
    await db.setProfilingLevel(ProfilingLevel.all);

    req = module.get(Request);
    req.reject = true; /* Reject for non 2xx response codes */
    await app.listen(req.socket);
  });

  afterEach(() => app.close());

  beforeEach(async () => {
    await Promise.all([req.post("/bucket", bucket1), req.post("/bucket", bucket2)]);

    // to make db insert profile entry
    await Promise.all([
      req.post(`/bucket/${bucket1._id}/data`, {name: "Hello"}),
      req.get(`/bucket/${bucket1._id}/data`),
      req.post(`/bucket/${bucket2._id}/data`, {name: "Hi"}),
      req.get(`/bucket/${bucket2._id}/data`)
    ]);

    bucket1Namespace = `test.bucket_${bucket1._id}`;
    bucket2Namespace = `test.bucket_${bucket2._id}`;
  });

  it("should list bucket1 data profile logs", async () => {
    const res = await req.get(`/bucket/${bucket1._id}/data/profile`);
    expect(res.statusCode).toEqual(200);
    expect(res.body.every(log => log.ns == "test.bucket_6824a87e86e3700817eadc77")).toEqual(true);
  });

  it("should list bucket2 data profile logs", async () => {
    const res = await req.get(`/bucket/${bucket2._id}/data/profile`);
    expect(res.statusCode).toEqual(200);
    expect(res.body.every(log => log.ns == "test.bucket_6824a894faa1408d00875d80")).toEqual(true);
  });

  it("should filter bucket1 profile logs by operation type", async () => {
    const res = await req.get(`/bucket/${bucket1._id}/data/profile`, {
      filter: JSON.stringify({op: "insert"})
    });
    expect(res.statusCode).toEqual(200);
    expect(res.body.every(log => log.ns == "test.bucket_6824a87e86e3700817eadc77")).toEqual(true);
    expect(res.body.every(log => log.op == "insert")).toEqual(true);
  });

  it("should limit bucket1 profile logs", async () => {
    const res = await req.get(`/bucket/${bucket1._id}/data/profile`, {
      limit: 1
    });
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toEqual(1);
    expect(res.body.every(log => log.ns == "test.bucket_6824a87e86e3700817eadc77")).toEqual(true);
  });

  it("should skip bucket1 profile logs", async () => {
    const {body: allLogs} = await req.get(`/bucket/${bucket1._id}/data/profile`);
    const res = await req.get(`/bucket/${bucket1._id}/data/profile`, {skip: 1});
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toEqual(allLogs.length - 1);

    allLogs.shift();
    expect(res.body).toEqual(allLogs);
  });

  it("should sort bucket1 profile logs", async () => {
    const {body: allLogs} = await req.get(`/bucket/${bucket1._id}/data/profile`);
    const res = await req.get(`/bucket/${bucket1._id}/data/profile`, {
      sort: JSON.stringify({ts: -1})
    });
    expect(res.statusCode).toEqual(200);
    expect(res.body).not.toEqual(allLogs);

    allLogs.reverse();
    expect(res.body).toEqual(allLogs);
  });

  // to prevent accessing other collections profile logs
  it("should ignore ns on filter", async () => {
    let res = await req.get(`/bucket/${bucket1._id}/data/profile`, {
      filter: JSON.stringify({ns: "test.buckets"})
    });

    expect(res.statusCode).toEqual(200);
    // user provided ns filter will be overridden
    expect(res.body.every(log => log.ns == "test.bucket_6824a87e86e3700817eadc77")).toEqual(true);
  });

  it("should ignore ns on the nested filter", async () => {
    let res = await req.get(`/bucket/${bucket1._id}/data/profile`, {
      filter: JSON.stringify({
        $or: [{ns: "test.bucket_6824a894faa1408d00875d80"}, {ns: "test.buckets"}]
      })
    });

    expect(res.statusCode).toEqual(200);
    // there is no such profile log for filter below
    /*
      {
        $or: [{ns: "test.bucket_6824a894faa1408d00875d80"}, {ns: "test.buckets"}]
        "ns": "test.bucket_6824a87e86e3700817eadc77"
      },
    */
    expect(res.body.length).toEqual(0);
  });
});
