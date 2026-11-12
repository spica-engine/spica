import {Test, TestingModule} from "@nestjs/testing";
import {contractSuite} from "@spica-server/database-testing";
import {ID_TYPES, IdTypes} from "@spica-server/interface-data";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {IdentityModule} from "@spica-server/passport-identity";
import {INestApplication} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core-schema";
import {OBJECT_ID} from "@spica-server/core-schema";
import {PreferenceTestingModule} from "@spica-server/preference-testing";
import {PolicyModule} from "@spica-server/passport-policy";
import {ConfigModule} from "@spica-server/config";
import {idOf, withId} from "@spica-server/data";

contractSuite("Identity Controller", engine => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;

  const missingId = () =>
    String(module.get<IdTypes>(ID_TYPES).forCollection("identity").generate());

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID]
        }),
        engine.module(),
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
          identityRealtime: false,
          refreshTokenHashSecret: "refresh_token_hash_secret"
        }),
        ConfigModule.forRoot(),
        PolicyModule.forRoot({realtime: false})
      ]
    }).compile();
    app = module.createNestApplication();

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
      expect(res.body).toMatchObject(
        withId({identifier: "user1", policies: []}, expect.any(String))
      );
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
      identity1Id = idOf(res1.body).toString();

      const res2 = await req.post("/passport/identity", {
        identifier: "user2",
        password: "password2"
      });
      identity2Id = idOf(res2.body).toString();
    });

    it("should list all identities without password fields", async () => {
      const res = await req.get("/passport/identity", {sort: JSON.stringify({identifier: 1})});
      expect(res.statusCode).toEqual(200);
      expect(res.body).toMatchObject([
        withId({identifier: "user1", policies: []}, identity1Id),
        withId({identifier: "user2", policies: []}, identity2Id)
      ]);
    });

    it("should limit results", async () => {
      const res = await req.get("/passport/identity", {
        sort: JSON.stringify({identifier: 1}),
        limit: 1
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toMatchObject([withId({identifier: "user1", policies: []}, identity1Id)]);
    });

    it("should filter by identifier", async () => {
      const filter =
        engine.name == "mongodb"
          ? JSON.stringify({identifier: "user2"})
          : "document.identifier == 'user2'";
      const res = await req.get("/passport/identity", {filter});
      expect(res.statusCode).toEqual(200);
      expect(res.body).toMatchObject([withId({identifier: "user2", policies: []}, identity2Id)]);
    });

    it("should answer 404 for a filter in the language of the other engine", async () => {
      const filter =
        engine.name == "mongodb"
          ? "document.identifier == 'user1'"
          : JSON.stringify({identifier: "user1"});
      const res = await req.get("/passport/identity", {filter});
      expect(res.statusCode).toEqual(404);
    });

    it("should skip results", async () => {
      const res = await req.get("/passport/identity", {
        sort: JSON.stringify({identifier: 1}),
        skip: 1
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toMatchObject([withId({identifier: "user2", policies: []}, identity2Id)]);
    });

    it("should sort results", async () => {
      const res = await req.get("/passport/identity", {
        sort: JSON.stringify({identifier: -1})
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toMatchObject([
        withId({identifier: "user2", policies: []}, identity2Id),
        withId({identifier: "user1", policies: []}, identity1Id)
      ]);
    });

    it("should paginate results", async () => {
      const res = await req.get("/passport/identity", {
        paginate: true,
        sort: JSON.stringify({identifier: 1})
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toMatchObject({
        meta: {total: 2},
        data: [
          withId({identifier: "user1", policies: []}, identity1Id),
          withId({identifier: "user2", policies: []}, identity2Id)
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
      expect(res.body).toMatchObject({
        meta: {total: 2},
        data: [withId({identifier: "user2", policies: []}, identity2Id)]
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
      identityId = idOf(res.body).toString();
    });

    it("should return an identity by id without password fields", async () => {
      const res = await req.get(`/passport/identity/${identityId}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body).toMatchObject(withId({identifier: "user1", policies: []}, identityId));
    });

    it("should return 404 for non-existing identity", async () => {
      const nonExistingId = missingId();
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
      identityId = idOf(res.body).toString();
    });

    it("should update an identity's identifier", async () => {
      const res = await req.put(`/passport/identity/${identityId}`, {
        identifier: "updated_user1"
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toMatchObject(
        withId({identifier: "updated_user1", policies: []}, identityId)
      );
    });

    it("should update an identity's password without exposing password fields", async () => {
      const res = await req.put(`/passport/identity/${identityId}`, {
        identifier: "user1",
        password: "new_password"
      });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toMatchObject(
        withId(
          {identifier: "user1", policies: [], deactivateJwtsBefore: expect.any(Number)},
          identityId
        )
      );
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
      const nonExistingId = missingId();
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
      identity1Id = idOf(res1.body).toString();

      const res2 = await req.post("/passport/identity", {
        identifier: "user2",
        password: "password2"
      });
      identity2Id = idOf(res2.body).toString();
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
      expect(getRes.body).toMatchObject(withId({identifier: "user2", policies: []}, identity2Id));
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
      identityId = idOf(identityRes.body).toString();

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
      policyId = idOf(policyRes.body).toString();
    });

    it("should add a policy to an identity", async () => {
      const res = await req.put(`/passport/identity/${identityId}/policy/${policyId}`);
      expect(res.statusCode).toEqual(204);

      const getRes = await req.get(`/passport/identity/${identityId}`);
      expect(getRes.statusCode).toEqual(200);
      expect(getRes.body).toMatchObject(
        withId({identifier: "user1", policies: [policyId]}, identityId)
      );
    });

    it("should not duplicate when adding same policy twice", async () => {
      await req.put(`/passport/identity/${identityId}/policy/${policyId}`);
      await req.put(`/passport/identity/${identityId}/policy/${policyId}`);

      const getRes = await req.get(`/passport/identity/${identityId}`);
      expect(getRes.statusCode).toEqual(200);
      expect(getRes.body).toMatchObject(
        withId({identifier: "user1", policies: [policyId]}, identityId)
      );
    });

    it("should remove a policy from an identity", async () => {
      await req.put(`/passport/identity/${identityId}/policy/${policyId}`);

      const res = await req.delete(`/passport/identity/${identityId}/policy/${policyId}`);
      expect(res.statusCode).toEqual(204);

      const getRes = await req.get(`/passport/identity/${identityId}`);
      expect(getRes.statusCode).toEqual(200);
      expect(getRes.body).toMatchObject(withId({identifier: "user1", policies: []}, identityId));
    });

    it("should return 404 when adding policy to non-existing identity", async () => {
      const res = await req.put(`/passport/identity/${missingId()}/policy/${policyId}`);
      expect(res.statusCode).toEqual(404);
      expect(res.body).toEqual({
        statusCode: 404,
        message: expect.stringContaining("not found"),
        error: "Not Found"
      });
    });

    it("should return 404 when removing policy from non-existing identity", async () => {
      const res = await req.delete(`/passport/identity/${missingId()}/policy/${policyId}`);
      expect(res.statusCode).toEqual(404);
      expect(res.body).toEqual({
        statusCode: 404,
        message: expect.stringContaining("not found"),
        error: "Not Found"
      });
    });
  });
});
