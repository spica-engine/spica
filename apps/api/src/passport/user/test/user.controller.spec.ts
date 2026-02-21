import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseService, DatabaseTestingModule} from "@spica-server/database/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {INestApplication} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core/schema";
import {DATE_TIME, OBJECT_ID} from "@spica-server/core/schema/formats";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {PassportModule} from "@spica-server/passport";

describe("User Controller CRUD Operations", () => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;
  let database: DatabaseService;
  let adminToken: string;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID, DATE_TIME]
        }),
        DatabaseTestingModule.replicaSet(),
        PreferenceTestingModule,
        CoreTestingModule,
        PassportModule.forRoot({
          publicUrl: "http://localhost:3000",
          samlCertificateTTL: 604800,
          defaultStrategy: "IDENTITY",
          apikeyRealtime: false,
          refreshTokenRealtime: false,
          policyRealtime: false,
          identityOptions: {
            expiresIn: 60000,
            maxExpiresIn: 60000,
            issuer: "spica",
            secretOrKey: "spica",
            audience: "spica",
            defaultIdentityIdentifier: "spica",
            defaultIdentityPassword: "spica",
            defaultIdentityPolicies: ["UserFullAccess", "IdentityFullAccess", "PolicyFullAccess"],
            blockingOptions: {
              blockDurationMinutes: 0,
              failedAttemptLimit: 0
            },
            refreshTokenExpiresIn: 60000,
            passwordHistoryLimit: 0,
            identityRealtime: false
          },
          userOptions: {
            expiresIn: 60000,
            maxExpiresIn: 60000,
            issuer: "spica",
            secretOrKey: "spica",
            audience: "spica",
            blockingOptions: {
              blockDurationMinutes: 0,
              failedAttemptLimit: 0
            },
            refreshTokenExpiresIn: 60000,
            passwordHistoryLimit: 0,
            userRealtime: false
          }
        })
      ]
    }).compile();

    app = module.createNestApplication();
    req = module.get(Request);
    database = module.get(DatabaseService);

    await app.listen(req.socket);

    await new Promise(resolve => setTimeout(resolve, 3000));

    adminToken = await req
      .post("/passport/identify", {
        identifier: "spica",
        password: "spica"
      })
      .then(res => res.body.token);
  });

  afterAll(() => app.close());

  afterEach(async () => {
    await database.collection("user").deleteMany({});
  });

  describe("POST /passport/user (create)", () => {
    it("should create a user with IDENTITY token", async () => {
      const res = await req.post(
        "/passport/user",
        {username: "newuser", password: "password123"},
        {Authorization: `IDENTITY ${adminToken}`}
      );

      expect(res.statusCode).toBe(201);
      expect(res.body._id).toBeDefined();
      expect(res.body.username).toBe("newuser");
      expect(res.body.password).toBeUndefined();
      expect(res.body.lastPasswords).toBeUndefined();
      expect(res.body.policies).toEqual([]);
    });

    it("should reject creating a user with USER token", async () => {
      await req.post(
        "/passport/user",
        {username: "tempuser", password: "password123"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      const userToken = await req
        .post("/passport/login", {username: "tempuser", password: "password123"})
        .then(r => r.body.token);

      const res = await req.post(
        "/passport/user",
        {username: "anotheruser", password: "password123"},
        {Authorization: `USER ${userToken}`}
      );

      expect(res.statusCode).toBe(401);
    });

    it("should reject creating a user without authorization", async () => {
      const res = await req.post("/passport/user", {
        username: "noauthuser",
        password: "password123"
      });

      expect(res.statusCode).toBe(401);
    });

    it("should reject duplicate usernames", async () => {
      await req.post(
        "/passport/user",
        {username: "duplicate", password: "password123"},
        {Authorization: `IDENTITY ${adminToken}`}
      );

      const res = await req.post(
        "/passport/user",
        {username: "duplicate", password: "password456"},
        {Authorization: `IDENTITY ${adminToken}`}
      );

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("User already exists");
    });

    it("should reject missing username", async () => {
      const res = await req.post(
        "/passport/user",
        {password: "password123"},
        {Authorization: `IDENTITY ${adminToken}`}
      );

      expect(res.statusCode).toBe(400);
    });

    it("should reject missing password", async () => {
      const res = await req.post(
        "/passport/user",
        {username: "nopassword"},
        {Authorization: `IDENTITY ${adminToken}`}
      );

      expect(res.statusCode).toBe(400);
    });

    it("should reject additional properties on create", async () => {
      const res = await req.post(
        "/passport/user",
        {username: "extrafields", password: "password123", policies: ["SomePolicy"]},
        {Authorization: `IDENTITY ${adminToken}`}
      );

      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /passport/user (list)", () => {
    beforeEach(async () => {
      await req.post(
        "/passport/user",
        {username: "listuser1", password: "password1"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      await req.post(
        "/passport/user",
        {username: "listuser2", password: "password2"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
    });

    it("should list users with IDENTITY token", async () => {
      const res = await req.get("/passport/user", undefined, {
        Authorization: `IDENTITY ${adminToken}`
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBe(2);
      expect(res.body[0].username).toBe("listuser1");
      expect(res.body[1].username).toBe("listuser2");
    });

    it("should reject getting users with USER token", async () => {
      const userToken = await req
        .post("/passport/login", {username: "listuser1", password: "password1"})
        .then(r => r.body.token);

      const res = await req.get("/passport/user", undefined, {
        Authorization: `USER ${userToken}`
      });

      expect(res.statusCode).toBe(401);
    });

    it("should reject getting users without authorization", async () => {
      const res = await req.get("/passport/user");

      expect(res.statusCode).toBe(401);
    });

    it("should support limit, skip and sort together", async () => {
      const res = await req.get(
        "/passport/user",
        {
          sort: JSON.stringify({username: -1}),
          skip: 1,
          limit: 1
        },
        {Authorization: `IDENTITY ${adminToken}`}
      );

      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].username).toBe("listuser1");
    });

    it("should return paginated response with meta", async () => {
      const res = await req.get(
        "/passport/user",
        {paginate: true},
        {Authorization: `IDENTITY ${adminToken}`}
      );

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        meta: {total: 2},
        data: [
          expect.objectContaining({username: "listuser1"}),
          expect.objectContaining({username: "listuser2"})
        ]
      });
    });

    it("should filter users by username", async () => {
      const res = await req.get(
        "/passport/user",
        {filter: JSON.stringify({username: "listuser1"})},
        {Authorization: `IDENTITY ${adminToken}`}
      );

      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].username).toBe("listuser1");
    });
  });

  describe("GET /passport/user/:id (find one)", () => {
    let userId: string;
    let userToken: string;

    beforeEach(async () => {
      const createRes = await req.post(
        "/passport/user",
        {username: "finduser", password: "password123"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      userId = createRes.body._id;

      userToken = await req
        .post("/passport/login", {username: "finduser", password: "password123"})
        .then(r => r.body.token);
    });

    it("should find user by ID with IDENTITY token", async () => {
      const res = await req.get(`/passport/user/${userId}`, undefined, {
        Authorization: `IDENTITY ${adminToken}`
      });

      expect(res.statusCode).toBe(200);
      expect(res.body._id).toBe(userId);
      expect(res.body.username).toBe("finduser");
      expect(res.body.password).toBeUndefined();
      expect(res.body.lastPasswords).toBeUndefined();
    });

    it("should allow USER token to find own user by ID", async () => {
      const res = await req.get(`/passport/user/${userId}`, undefined, {
        Authorization: `USER ${userToken}`
      });

      expect(res.statusCode).toBe(200);
      expect(res.body._id).toBe(userId);
      expect(res.body.username).toBe("finduser");
    });

    it("should reject finding user without authorization", async () => {
      const res = await req.get(`/passport/user/${userId}`);

      expect(res.statusCode).toBe(401);
    });

    it("should return 404 for non-existent user ID", async () => {
      const fakeId = "000000000000000000000000";
      const res = await req.get(`/passport/user/${fakeId}`, undefined, {
        Authorization: `IDENTITY ${adminToken}`
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("PUT /passport/user/:id (admin update)", () => {
    let userId: string;
    let userToken: string;

    beforeEach(async () => {
      const createRes = await req.post(
        "/passport/user",
        {username: "updateuser", password: "password123"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      userId = createRes.body._id;

      userToken = await req
        .post("/passport/login", {username: "updateuser", password: "password123"})
        .then(r => r.body.token);
    });

    it("should update user with IDENTITY token", async () => {
      const res = await req.put(
        `/passport/user/${userId}`,
        {username: "updatedname"},
        {Authorization: `IDENTITY ${adminToken}`}
      );

      expect(res.statusCode).toBe(200);
      expect(res.body.username).toBe("updatedname");
      expect(res.body.password).toBeUndefined();
    });

    it("should reject updating user with USER token", async () => {
      const res = await req.put(
        `/passport/user/${userId}`,
        {username: "hackedname"},
        {Authorization: `USER ${userToken}`}
      );

      expect(res.statusCode).toBe(401);
    });

    it("should reject updating user without authorization", async () => {
      const res = await req.put(`/passport/user/${userId}`, {username: "noauth"});

      expect(res.statusCode).toBe(401);
    });

    it("should update password via admin endpoint", async () => {
      const res = await req.put(
        `/passport/user/${userId}`,
        {password: "newAdminSetPassword"},
        {Authorization: `IDENTITY ${adminToken}`}
      );

      expect(res.statusCode).toBe(200);

      const loginRes = await req.post("/passport/login", {
        username: "updateuser",
        password: "newAdminSetPassword"
      });
      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.body.token).toBeDefined();
    });

    it("should update username and password together", async () => {
      const res = await req.put(
        `/passport/user/${userId}`,
        {username: "newname", password: "newpass123"},
        {Authorization: `IDENTITY ${adminToken}`}
      );

      expect(res.statusCode).toBe(200);
      expect(res.body.username).toBe("newname");

      const loginRes = await req.post("/passport/login", {
        username: "newname",
        password: "newpass123"
      });
      expect(loginRes.statusCode).toBe(200);
    });

    it("should reject duplicate username on update", async () => {
      await req.post(
        "/passport/user",
        {username: "existinguser", password: "password123"},
        {Authorization: `IDENTITY ${adminToken}`}
      );

      const res = await req.put(
        `/passport/user/${userId}`,
        {username: "existinguser"},
        {Authorization: `IDENTITY ${adminToken}`}
      );

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("User already exists");
    });
  });

  describe("PUT /passport/user/:id/self (self update)", () => {
    let user1Id: string;
    let user1Token: string;
    let user2Id: string;

    beforeEach(async () => {
      const [res1, res2] = await Promise.all([
        req.post(
          "/passport/user",
          {username: "selfuser1", password: "password1"},
          {Authorization: `IDENTITY ${adminToken}`}
        ),
        req.post(
          "/passport/user",
          {username: "selfuser2", password: "password2"},
          {Authorization: `IDENTITY ${adminToken}`}
        )
      ]);

      user1Id = res1.body._id;
      user2Id = res2.body._id;

      user1Token = await req
        .post("/passport/login", {username: "selfuser1", password: "password1"})
        .then(r => r.body.token);
    });

    it("should allow user to update own password via self endpoint", async () => {
      const res = await req.put(
        `/passport/user/${user1Id}/self`,
        {password: "newselfpassword"},
        {Authorization: `USER ${user1Token}`}
      );

      expect(res.statusCode).toBe(200);
      expect(res.body._id).toBe(user1Id);
      expect(res.body.password).toBeUndefined();

      const loginRes = await req.post("/passport/login", {
        username: "selfuser1",
        password: "newselfpassword"
      });
      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.body.token).toBeDefined();
    });

    it("should reject old password after self-update", async () => {
      await req.put(
        `/passport/user/${user1Id}/self`,
        {password: "changedpassword"},
        {Authorization: `USER ${user1Token}`}
      );

      const oldLoginRes = await req.post("/passport/login", {
        username: "selfuser1",
        password: "password1"
      });
      expect(oldLoginRes.statusCode).toBe(401);
    });

    it("should reject updating another user via self endpoint", async () => {
      const res = await req.put(
        `/passport/user/${user2Id}/self`,
        {password: "hackedpassword"},
        {Authorization: `USER ${user1Token}`}
      );

      expect(res.statusCode).toBe(403);

      const loginRes = await req.post("/passport/login", {
        username: "selfuser2",
        password: "password2"
      });
      expect(loginRes.statusCode).toBe(200);
    });

    it("should reject additional properties (bannedUntil) via self endpoint", async () => {
      const res = await req.put(
        `/passport/user/${user1Id}/self`,
        {password: "newpass", bannedUntil: new Date(Date.now() + 10000).toISOString()},
        {Authorization: `USER ${user1Token}`}
      );

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("bannedUntil");
    });

    it("should reject additional properties (username) via self endpoint", async () => {
      const res = await req.put(
        `/passport/user/${user1Id}/self`,
        {password: "newpass", username: "newname"},
        {Authorization: `USER ${user1Token}`}
      );

      expect(res.statusCode).toBe(400);
    });

    it("should reject self update without authorization", async () => {
      const res = await req.put(`/passport/user/${user1Id}/self`, {password: "newpass"});

      expect(res.statusCode).toBe(401);
    });

    it("should allow IDENTITY token on self endpoint", async () => {
      const res = await req.put(
        `/passport/user/${user1Id}/self`,
        {password: "adminsetpass"},
        {Authorization: `IDENTITY ${adminToken}`}
      );

      expect(res.statusCode).toBe(200);
    });
  });

  describe("DELETE /passport/user/:id (delete)", () => {
    let userId: string;
    let userToken: string;

    beforeEach(async () => {
      const createRes = await req.post(
        "/passport/user",
        {username: "deleteuser", password: "password123"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      userId = createRes.body._id;

      userToken = await req
        .post("/passport/login", {username: "deleteuser", password: "password123"})
        .then(r => r.body.token);
    });

    it("should delete user with IDENTITY token", async () => {
      const res = await req.delete(`/passport/user/${userId}`, undefined, {
        Authorization: `IDENTITY ${adminToken}`
      });
      expect(res.statusCode).toBe(204);

      const findRes = await req.get(`/passport/user/${userId}`, undefined, {
        Authorization: `IDENTITY ${adminToken}`
      });

      expect(findRes.statusCode).toBe(404);
      expect(findRes.body.message).toContain(`User with ID ${userId} not found`);
    });

    it("should reject deleting user with USER token", async () => {
      const res = await req.delete(`/passport/user/${userId}`, undefined, {
        Authorization: `USER ${userToken}`
      });

      expect(res.statusCode).toBe(401);

      const findRes = await req.get(`/passport/user/${userId}`, undefined, {
        Authorization: `IDENTITY ${adminToken}`
      });
      expect(findRes.statusCode).toBe(200);
      expect(findRes.body._id).toBe(userId);
    });

    it("should reject deleting user without authorization", async () => {
      const res = await req.delete(`/passport/user/${userId}`);

      expect(res.statusCode).toBe(401);
    });
  });

  describe("PUT /passport/user/:id/policy/:policyId (add policy)", () => {
    let userId: string;
    let userToken: string;

    beforeEach(async () => {
      const createRes = await req.post(
        "/passport/user",
        {username: "policyuser", password: "password123"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      userId = createRes.body._id;

      userToken = await req
        .post("/passport/login", {username: "policyuser", password: "password123"})
        .then(r => r.body.token);
    });

    it("should add policy with IDENTITY token", async () => {
      const res = await req.put(`/passport/user/${userId}/policy/TestPolicy`, undefined, {
        Authorization: `IDENTITY ${adminToken}`
      });

      expect(res.statusCode).toBe(204);
    });

    it("should reject adding policy with USER token", async () => {
      const res = await req.put(`/passport/user/${userId}/policy/TestPolicy`, undefined, {
        Authorization: `USER ${userToken}`
      });

      expect(res.statusCode).toBe(401);
    });

    it("should not duplicate policies on repeated adds", async () => {
      await req.put(`/passport/user/${userId}/policy/UniquePolicy`, undefined, {
        Authorization: `IDENTITY ${adminToken}`
      });
      await req.put(`/passport/user/${userId}/policy/UniquePolicy`, undefined, {
        Authorization: `IDENTITY ${adminToken}`
      });

      const userRes = await req.get(`/passport/user/${userId}`, undefined, {
        Authorization: `IDENTITY ${adminToken}`
      });

      const policyCount = userRes.body.policies.filter(p => p === "UniquePolicy").length;
      expect(policyCount).toBe(1);
    });
  });

  describe("DELETE /passport/user/:id/policy/:policyId (remove policy)", () => {
    let userId: string;
    let userToken: string;

    beforeEach(async () => {
      const createRes = await req.post(
        "/passport/user",
        {username: "rmpolicyuser", password: "password123"},
        {Authorization: `IDENTITY ${adminToken}`}
      );
      userId = createRes.body._id;

      await req.put(`/passport/user/${userId}/policy/RemovablePolicy`, undefined, {
        Authorization: `IDENTITY ${adminToken}`
      });

      userToken = await req
        .post("/passport/login", {username: "rmpolicyuser", password: "password123"})
        .then(r => r.body.token);
    });

    it("should remove policy with IDENTITY token", async () => {
      const res = await req.delete(`/passport/user/${userId}/policy/RemovablePolicy`, undefined, {
        Authorization: `IDENTITY ${adminToken}`
      });

      expect(res.statusCode).toBe(204);

      const userRes = await req.get(`/passport/user/${userId}`, undefined, {
        Authorization: `IDENTITY ${adminToken}`
      });
      expect(userRes.body.policies).not.toContain("RemovablePolicy");
    });

    it("should reject removing policy with USER token", async () => {
      const res = await req.delete(`/passport/user/${userId}/policy/RemovablePolicy`, undefined, {
        Authorization: `USER ${userToken}`
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
