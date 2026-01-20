import {Test, TestingModule} from "@nestjs/testing";
import {
  DatabaseService,
  DatabaseTestingModule,
  ProfilingLevel
} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {UserModule} from "@spica-server/passport/user";
import {INestApplication} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECT_ID} from "@spica-server/core/schema/formats";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {PolicyModule} from "@spica-server/passport/policy";

describe("user Controller", () => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;
  let db: DatabaseService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID]
        }),
        DatabaseTestingModule.replicaSet(),
        PassportTestingModule.initialize(),
        PreferenceTestingModule,
        CoreTestingModule,
        UserModule.forRoot({
          expiresIn: 1000,
          issuer: "spica",
          maxExpiresIn: 1000,
          secretOrKey: "spica",
          passwordHistoryLimit: 0,
          blockingOptions: {
            blockDurationMinutes: 0,
            failedAttemptLimit: 0
          },
          userRealtime: false
        }),
        PolicyModule.forRoot({realtime: false})
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
      // to make db insert profile entry
      await Promise.all([
        // unrelated operation to ensure ns filter working correctly
        db.collection("buckets").insertOne({}),
        req.post("/passport/user", {username: "user1", password: "password1"}),
        req.get("/passport/user")
      ]);
    });

    it("should list user profile entries", async () => {
      const res = await req.get("/passport/user/profile");
      expect(res.statusCode).toEqual(200);
      expect(res.body.every(profileEntry => profileEntry.ns.endsWith(".user"))).toEqual(true);
    });

    it("should filter user profile entries by operation type", async () => {
      const res = await req.get("/passport/user/profile", {
        filter: JSON.stringify({op: "insert"})
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body.every(profileEntry => profileEntry.op == "insert")).toEqual(true);
      expect(res.body.every(profileEntry => profileEntry.ns.endsWith(".user"))).toEqual(true);
    });

    it("should limit user profile entries", async () => {
      const res = await req.get("/passport/user/profile", {
        limit: 1
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body.length).toEqual(1);
      expect(res.body.every(profileEntry => profileEntry.ns.endsWith(".user"))).toEqual(true);
    });

    it("should skip bucket1 profile entries", async () => {
      const {body: allProfileEntries} = await req.get("/passport/user/profile");
      const res = await req.get("/passport/user/profile", {skip: 1});
      expect(res.statusCode).toEqual(200);
      expect(res.body.length).toEqual(allProfileEntries.length - 1);

      allProfileEntries.shift();
      expect(res.body).toEqual(allProfileEntries);
      expect(res.body.every(profileEntry => profileEntry.ns.endsWith(".user"))).toEqual(true);
    });

    it("should sort bucket1 profile entries", async () => {
      const {body: allProfileEntries} = await req.get("/passport/user/profile");
      const res = await req.get("/passport/user/profile", {sort: JSON.stringify({ts: -1})});
      expect(res.statusCode).toEqual(200);
      expect(res.body).not.toEqual(allProfileEntries);

      allProfileEntries.reverse();
      expect(res.body).toEqual(allProfileEntries);
      expect(res.body.every(profileEntry => profileEntry.ns.endsWith(".user"))).toEqual(true);
    });

    // to prevent accessing other collections profile entries
    it("should ignore ns on filter", async () => {
      let res = await req.get("/passport/user/profile", {
        filter: JSON.stringify({ns: "test.buckets"})
      });

      expect(res.statusCode).toEqual(200);
      // user provided ns filter will be overridden
      expect(res.body.every(profileEntry => profileEntry.ns.endsWith(".user"))).toEqual(true);
    });

    it("should ignore ns on the nested filter", async () => {
      let res = await req.get("/passport/user/profile", {
        filter: JSON.stringify({
          $or: [{ns: "test.functions"}, {ns: "test.buckets"}]
        })
      });

      expect(res.statusCode).toEqual(200);
      // there is no such profile entries for filter below
      /*
      {
        $or: [{ns: "test.functions"}, {ns: "test.buckets"}]
        "ns": "test.user"
      },
    */
      expect(res.body.length).toEqual(0);
    });
  });
});
