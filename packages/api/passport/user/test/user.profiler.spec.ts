import {Test, TestingModule} from "@nestjs/testing";
import {
  DatabaseService,
  DatabaseTestingModule,
  ProfilingLevel
} from "@spica-server/database-testing";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {UserModule} from "@spica-server/passport-user";
import {INestApplication} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core-schema";
import {OBJECT_ID} from "@spica-server/core-schema";
import {PreferenceTestingModule} from "@spica-server/preference-testing";
import {PolicyModule} from "@spica-server/passport-policy";
import {ConfigModule} from "@spica-server/config";

describe("user Controller", () => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;
  let db: DatabaseService;
  let profilerAvailable: boolean;

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
        ConfigModule.forRoot(),
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
          userRealtime: false,
          refreshTokenHashSecret: "refresh_token_hash_secret"
        }),
        PolicyModule.forRoot({realtime: false})
      ]
    }).compile();
    app = module.createNestApplication();

    db = module.get(DatabaseService);

    /**
     * The profiler **depends on a capability** (K-10). Mongo keeps a profile per collection
     * (`system.profile`); PostgreSQL's `pg_stat_statements` is a different interface and `findOnProfiler`
     * does not exist there. This whole file is profiler-specific, so it is out of scope on the PG leg —
     * recorded in `pg-known-failures.md`.
     */
    profilerAvailable = db.capabilities.queryProfiler === "system.profile";
    if (profilerAvailable) {
      await db.setProfilingLevel(ProfilingLevel.all);
    }

    req = module.get(Request);
    await app.listen(req.socket);
  });

  afterEach(() => app.close());

  describe("profiler", () => {
    /**
     * A profile entry is written by the server **after** it has answered, so a request returning is not a
     * promise that its entry is already queryable. The pagination tests need at least two, and they used to
     * read whatever happened to be there: once the shared test server stopped being the slow part the race
     * became visible, 1 run in 3 (D26, R123). Waiting for the entries to appear is the assertion the tests
     * actually depend on.
     */
    async function waitForProfileEntries(minimum: number) {
      for (let attempt = 0; attempt < 50; attempt++) {
        const {body} = await req.get("/passport/user/profile");
        if (Array.isArray(body) && body.length >= minimum) return body;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error(`the profiler did not record ${minimum} entries for the user collection`);
    }

    beforeEach(async () => {
      if (!profilerAvailable) return;
      // to make db insert profile entry
      await Promise.all([
        // unrelated operation to ensure ns filter working correctly
        db.collection("buckets").insertOne({}),
        req.post("/passport/user", {username: "user1", password: "password1"}),
        req.get("/passport/user")
      ]);
      await waitForProfileEntries(2);
    });

    it("should list user profile entries", async () => {
      if (!profilerAvailable) return;
      const res = await req.get("/passport/user/profile");
      expect(res.statusCode).toEqual(200);
      expect(res.body.every(profileEntry => profileEntry.ns.endsWith(".user"))).toEqual(true);
    });

    it("should filter user profile entries by operation type", async () => {
      if (!profilerAvailable) return;
      const res = await req.get("/passport/user/profile", {
        filter: JSON.stringify({op: "insert"})
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body.every(profileEntry => profileEntry.op == "insert")).toEqual(true);
      expect(res.body.every(profileEntry => profileEntry.ns.endsWith(".user"))).toEqual(true);
    });

    it("should limit user profile entries", async () => {
      if (!profilerAvailable) return;
      const res = await req.get("/passport/user/profile", {
        limit: 1
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body.length).toEqual(1);
      expect(res.body.every(profileEntry => profileEntry.ns.endsWith(".user"))).toEqual(true);
    });

    it("should skip user profile entries", async () => {
      if (!profilerAvailable) return;
      const [{body: allProfileEntries}, skippedRes] = await Promise.all([
        req.get("/passport/user/profile", {limit: 2, sort: JSON.stringify({_id: 1})}),
        req.get("/passport/user/profile", {skip: 1, limit: 1, sort: JSON.stringify({_id: 1})})
      ]);
      expect(skippedRes.statusCode).toEqual(200);
      expect(skippedRes.body.length).toEqual(1);
      expect(skippedRes.body[0]._id).toEqual(allProfileEntries[1]._id);
      expect(skippedRes.body.every(profileEntry => profileEntry.ns.endsWith(".user"))).toEqual(
        true
      );
    });

    it("should sort user profile entries", async () => {
      if (!profilerAvailable) return;
      const response = await req.get("/passport/user/profile", {
        sort: JSON.stringify({ts: -1})
      });
      expect(response.statusCode).toEqual(200);

      for (let i = 1; i < response.body.length; i++) {
        expect(response.body[i - 1].ts >= response.body[i].ts).toEqual(true);
      }

      expect(response.body.every(profileEntry => profileEntry.ns.endsWith(".user"))).toEqual(true);
    });

    // to prevent accessing other collections profile entries
    it("should ignore ns on filter", async () => {
      if (!profilerAvailable) return;
      let res = await req.get("/passport/user/profile", {
        filter: JSON.stringify({ns: "test.buckets"})
      });

      expect(res.statusCode).toEqual(200);
      // user provided ns filter will be overridden
      expect(res.body.every(profileEntry => profileEntry.ns.endsWith(".user"))).toEqual(true);
    });

    it("should ignore ns on the nested filter", async () => {
      if (!profilerAvailable) return;
      const dbName = db.databaseName;
      let res = await req.get("/passport/user/profile", {
        filter: JSON.stringify({
          $or: [{ns: `${dbName}.functions`}, {ns: `${dbName}.buckets`}]
        })
      });

      expect(res.statusCode).toEqual(200);
      // there is no such profile entries for filter below combined with the forced ns:
      /*
      {
        $or: [{ns: "<db>.functions"}, {ns: "<db>.buckets"}],
        "ns": "<db>.user"
      }
    */
      expect(res.body.length).toEqual(0);
    });
  });
});
