import {Test, TestingModule} from "@nestjs/testing";
import {
  DatabaseService,
  DatabaseTestingModule,
  ProfilingLevel
} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {IdentityModule} from "@spica-server/passport/identity";
import {INestApplication} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECT_ID} from "@spica-server/core/schema/formats";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {PolicyModule} from "@spica-server/passport/policy";

describe("Identity Controller", () => {
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
        DatabaseTestingModule.standalone(),
        PassportTestingModule.initialize(),
        PreferenceTestingModule,
        CoreTestingModule,
        IdentityModule.forRoot({
          expiresIn: 1000,
          issuer: "spica",
          maxExpiresIn: 1000,
          secretOrKey: "spica",
          passwordHistoryLimit: 0,
          blockingOptions: {
            blockDurationMinutes: 0,
            failedAttemptLimit: 0
          },
          identityRealtime: false
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

  describe("insert", () => {
    it("should create an identity", async () => {
      const res = await req.post("/passport/identity", {
        identifier: "user1",
        password: "password1"
      });
      expect(res.statusCode).toEqual(201);
      expect(res.body).toEqual({
        _id: expect.any(String),
        identifier: "user1",
        policies: []
      });
    });

    it("should fail if identifier is missing", async () => {
      const res = await req.post("/passport/identity", {
        password: "password1"
      });
      expect(res.statusCode).toEqual(400);
    });

    it("should fail if password is missing", async () => {
      const res = await req.post("/passport/identity", {
        identifier: "user1"
      });
      expect(res.statusCode).toEqual(400);
    });

    it("should fail if identifier already exists", async () => {
      await req.post("/passport/identity", {
        identifier: "duplicate_user",
        password: "password1"
      });
      const res = await req.post("/passport/identity", {
        identifier: "duplicate_user",
        password: "password2"
      });
      expect(res.statusCode).toEqual(400);
      expect(res.body).toEqual({
        statusCode: 400,
        message: "Identity already exists.",
        error: "Bad Request"
      });
    });
  });

  describe("find", () => {
    let identity1Id: string;
    let identity2Id: string;

    beforeEach(async () => {
      const res1 = await req.post("/passport/identity", {
        identifier: "user1",
        password: "password1"
      });
      identity1Id = res1.body._id;

      const res2 = await req.post("/passport/identity", {
        identifier: "user2",
        password: "password2"
      });
      identity2Id = res2.body._id;
    });

    it("should list all identities without password fields", async () => {
      const res = await req.get("/passport/identity", {sort: JSON.stringify({identifier: 1})});
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual([
        {_id: identity1Id, identifier: "user1", policies: []},
        {_id: identity2Id, identifier: "user2", policies: []}
      ]);
    });

    it("should limit results", async () => {
      const res = await req.get("/passport/identity", {
        sort: JSON.stringify({identifier: 1}),
        limit: 1
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual([{_id: identity1Id, identifier: "user1", policies: []}]);
    });

    it("should skip results", async () => {
      const res = await req.get("/passport/identity", {
        sort: JSON.stringify({identifier: 1}),
        skip: 1
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual([{_id: identity2Id, identifier: "user2", policies: []}]);
    });

    it("should sort results", async () => {
      const res = await req.get("/passport/identity", {
        sort: JSON.stringify({identifier: -1})
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual([
        {_id: identity2Id, identifier: "user2", policies: []},
        {_id: identity1Id, identifier: "user1", policies: []}
      ]);
    });

    it("should paginate results", async () => {
      const res = await req.get("/passport/identity", {
        paginate: true,
        sort: JSON.stringify({identifier: 1})
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({
        meta: {total: 2},
        data: [
          {_id: identity1Id, identifier: "user1", policies: []},
          {_id: identity2Id, identifier: "user2", policies: []}
        ]
      });
    });

    it("should paginate with limit and skip", async () => {
      const res = await req.get("/passport/identity", {
        paginate: true,
        sort: JSON.stringify({identifier: 1}),
        limit: 1,
        skip: 1
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({
        meta: {total: 2},
        data: [{_id: identity2Id, identifier: "user2", policies: []}]
      });
    });
  });

  describe("findOne", () => {
    let identityId: string;

    beforeEach(async () => {
      const res = await req.post("/passport/identity", {
        identifier: "user1",
        password: "password1"
      });
      identityId = res.body._id;
    });

    it("should return an identity by id without password fields", async () => {
      const res = await req.get(`/passport/identity/${identityId}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({
        _id: identityId,
        identifier: "user1",
        policies: []
      });
    });

    it("should return 404 for non-existing identity", async () => {
      const nonExistingId = "000000000000000000000000";
      const res = await req.get(`/passport/identity/${nonExistingId}`);
      expect(res.statusCode).toEqual(404);
      expect(res.body).toEqual({
        statusCode: 404,
        message: `Identity with ID ${nonExistingId} not found.`,
        error: "Not Found"
      });
    });
  });

  describe("update", () => {
    let identityId: string;

    beforeEach(async () => {
      const res = await req.post("/passport/identity", {
        identifier: "user1",
        password: "password1"
      });
      identityId = res.body._id;
    });

    it("should update an identity's identifier", async () => {
      const res = await req.put(`/passport/identity/${identityId}`, {
        identifier: "updated_user1"
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({
        _id: identityId,
        identifier: "updated_user1",
        policies: []
      });
    });

    it("should update an identity's password without exposing password fields", async () => {
      const res = await req.put(`/passport/identity/${identityId}`, {
        identifier: "user1",
        password: "new_password"
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual({
        _id: identityId,
        identifier: "user1",
        policies: [],
        deactivateJwtsBefore: expect.any(Number)
      });
    });

    it("should fail when updating to a duplicate identifier", async () => {
      await req.post("/passport/identity", {
        identifier: "user2",
        password: "password2"
      });

      const res = await req.put(`/passport/identity/${identityId}`, {
        identifier: "user2",
        password: "password1"
      });
      expect(res.statusCode).toEqual(400);
      expect(res.body).toEqual({
        statusCode: 400,
        message: "Identity already exists.",
        error: "Bad Request"
      });
    });

    it("should return 400 with not found message for non-existing identity", async () => {
      const nonExistingId = "000000000000000000000000";
      const res = await req.put(`/passport/identity/${nonExistingId}`, {
        identifier: "ghost"
      });
      expect(res.statusCode).toEqual(400);
      expect(res.body).toEqual({
        statusCode: 400,
        message: `Identity with ID ${nonExistingId} not found`,
        error: "Bad Request"
      });
    });
  });

  describe("delete", () => {
    let identity1Id: string;
    let identity2Id: string;

    beforeEach(async () => {
      const res1 = await req.post("/passport/identity", {
        identifier: "user1",
        password: "password1"
      });
      identity1Id = res1.body._id;

      const res2 = await req.post("/passport/identity", {
        identifier: "user2",
        password: "password2"
      });
      identity2Id = res2.body._id;
    });

    it("should delete an identity", async () => {
      const res = await req.delete(`/passport/identity/${identity1Id}`);
      expect(res.statusCode).toEqual(204);

      const getRes = await req.get(`/passport/identity/${identity1Id}`);
      expect(getRes.statusCode).toEqual(404);
      expect(getRes.body).toEqual({
        statusCode: 404,
        message: `Identity with ID ${identity1Id} not found.`,
        error: "Not Found"
      });
    });

    it("should not delete the last identity", async () => {
      await req.delete(`/passport/identity/${identity1Id}`);

      const res = await req.delete(`/passport/identity/${identity2Id}`);
      expect(res.statusCode).toEqual(204);

      const getRes = await req.get(`/passport/identity/${identity2Id}`);
      expect(getRes.statusCode).toEqual(200);
      expect(getRes.body).toEqual({
        _id: identity2Id,
        identifier: "user2",
        policies: []
      });
    });
  });

  describe("policy", () => {
    let identityId: string;
    let policyId: string;

    beforeEach(async () => {
      const identityRes = await req.post("/passport/identity", {
        identifier: "user1",
        password: "password1"
      });
      identityId = identityRes.body._id;

      const policyRes = await req.post("/passport/policy", {
        name: "test_policy",
        description: "test policy",
        statement: [
          {
            action: "bucket:data:index",
            module: "bucket:data",
            resource: {include: ["*"], exclude: []}
          }
        ]
      });
      policyId = policyRes.body._id;
    });

    it("should add a policy to an identity", async () => {
      const res = await req.put(`/passport/identity/${identityId}/policy/${policyId}`);
      expect(res.statusCode).toEqual(204);

      const getRes = await req.get(`/passport/identity/${identityId}`);
      expect(getRes.statusCode).toEqual(200);
      expect(getRes.body).toEqual({
        _id: identityId,
        identifier: "user1",
        policies: [policyId]
      });
    });

    it("should not duplicate when adding same policy twice", async () => {
      await req.put(`/passport/identity/${identityId}/policy/${policyId}`);
      await req.put(`/passport/identity/${identityId}/policy/${policyId}`);

      const getRes = await req.get(`/passport/identity/${identityId}`);
      expect(getRes.statusCode).toEqual(200);
      expect(getRes.body).toEqual({
        _id: identityId,
        identifier: "user1",
        policies: [policyId]
      });
    });

    it("should remove a policy from an identity", async () => {
      await req.put(`/passport/identity/${identityId}/policy/${policyId}`);

      const res = await req.delete(`/passport/identity/${identityId}/policy/${policyId}`);
      expect(res.statusCode).toEqual(204);

      const getRes = await req.get(`/passport/identity/${identityId}`);
      expect(getRes.statusCode).toEqual(200);
      expect(getRes.body).toEqual({
        _id: identityId,
        identifier: "user1",
        policies: []
      });
    });

    it("should return 404 when adding policy to non-existing identity", async () => {
      const res = await req.put(`/passport/identity/000000000000000000000000/policy/${policyId}`);
      expect(res.statusCode).toEqual(404);
      expect(res.body).toEqual({
        statusCode: 404,
        message: expect.stringContaining("not found"),
        error: "Not Found"
      });
    });

    it("should return 404 when removing policy from non-existing identity", async () => {
      const res = await req.delete(
        `/passport/identity/000000000000000000000000/policy/${policyId}`
      );
      expect(res.statusCode).toEqual(404);
      expect(res.body).toEqual({
        statusCode: 404,
        message: expect.stringContaining("not found"),
        error: "Not Found"
      });
    });
  });

  describe("profiler", () => {
    beforeEach(async () => {
      // to make db insert profile entry
      await Promise.all([
        // unrelated operation to ensure ns filter working correctly
        db.collection("buckets").insertOne({}),
        req.post("/passport/identity", {identifier: "user1", password: "password1"}),
        req.get("/passport/identity")
      ]);
    });

    it("should list identity profile entries", async () => {
      const res = await req.get("/passport/identity/profile");
      expect(res.statusCode).toEqual(200);
      expect(res.body.every(profileEntry => profileEntry.ns.endsWith(".identity"))).toEqual(true);
    });

    it("should filter identity profile entries by operation type", async () => {
      const res = await req.get("/passport/identity/profile", {
        filter: JSON.stringify({op: "insert"})
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body.every(profileEntry => profileEntry.op == "insert")).toEqual(true);
      expect(res.body.every(profileEntry => profileEntry.ns.endsWith(".identity"))).toEqual(true);
    });

    it("should limit identity profile entries", async () => {
      const res = await req.get("/passport/identity/profile", {
        limit: 1
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body.length).toEqual(1);
      expect(res.body.every(profileEntry => profileEntry.ns.endsWith(".identity"))).toEqual(true);
    });

    it("should skip bucket1 profile entries", async () => {
      const [{body: allProfileEntries}, skippedRes] = await Promise.all([
        req.get("/passport/identity/profile"),
        req.get("/passport/identity/profile", {skip: 1})
      ]);
      expect(skippedRes.statusCode).toEqual(200);
      expect(skippedRes.body.length).toEqual(allProfileEntries.length - 1);

      allProfileEntries.shift();
      expect(skippedRes.body).toEqual(allProfileEntries);
      expect(skippedRes.body.every(profileEntry => profileEntry.ns.endsWith(".identity"))).toEqual(
        true
      );
    });

    it("should sort bucket1 profile entries", async () => {
      const response = await req.get("/passport/identity/profile", {
        sort: JSON.stringify({ts: -1})
      });
      expect(response.statusCode).toEqual(200);

      for (let i = 1; i < response.body.length; i++) {
        expect(response.body[i - 1].ts >= response.body[i].ts).toEqual(true);
      }

      expect(response.body.every(profileEntry => profileEntry.ns.endsWith(".identity"))).toEqual(
        true
      );
    });

    // to prevent accessing other collections profile entries
    it("should ignore ns on filter", async () => {
      let res = await req.get("/passport/identity/profile", {
        filter: JSON.stringify({ns: "test.buckets"})
      });

      expect(res.statusCode).toEqual(200);
      // user provided ns filter will be overridden
      expect(res.body.every(profileEntry => profileEntry.ns.endsWith(".identity"))).toEqual(true);
    });

    it("should ignore ns on the nested filter", async () => {
      let res = await req.get("/passport/identity/profile", {
        filter: JSON.stringify({
          $or: [{ns: "test.functions"}, {ns: "test.buckets"}]
        })
      });

      expect(res.statusCode).toEqual(200);
      // there is no such profile entries for filter below
      /*
      {
        $or: [{ns: "test.functions"}, {ns: "test.buckets"}]
        "ns": "test.identity"
      },
    */
      expect(res.body.length).toEqual(0);
    });
  });
});
