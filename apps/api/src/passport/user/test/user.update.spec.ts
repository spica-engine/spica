import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule, DatabaseService} from "@spica-server/database/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {PassportModule} from "@spica-server/passport";
import {INestApplication} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core/schema";
import {DATE_TIME, OBJECT_ID} from "@spica-server/core/schema/formats";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

describe("User Update Endpoints", () => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;
  let database: DatabaseService;
  let user1: any;
  let user2: any;
  let user1Token: string;
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

  beforeEach(async () => {
    const [res1, res2] = await Promise.all([
      req.post(
        "/passport/user",
        {
          username: "user1",
          password: "password1"
        },
        {
          Authorization: `IDENTITY ${adminToken}`
        }
      ),
      req.post(
        "/passport/user",
        {
          username: "user2",
          password: "password2"
        },
        {
          Authorization: `IDENTITY ${adminToken}`
        }
      )
    ]);

    user1 = res1.body;
    user2 = res2.body;

    const loginRes = await req.post(
      "/passport/login",
      {
        username: "user1",
        password: "password1"
      },
      {
        Authorization: `IDENTITY ${adminToken}`
      }
    );

    user1Token = loginRes.body.token;
  });

  afterAll(() => app.close());

  afterEach(async () => {
    await database.collection("user").deleteMany({});
  });

  describe("user self update", () => {
    it("should successfully update own password", async () => {
      const res = await req.put(
        `/passport/user/${user1._id}/self`,
        {
          password: "newPassword123"
        },
        {
          Authorization: `USER ${user1Token}`
        }
      );

      expect(res.statusCode).toEqual(200);
      expect(res.body._id).toEqual(user1._id);
      expect(res.body.username).toEqual("user1");
      expect(res.body.password).toBeUndefined();

      const loginRes = await req.post("/passport/login", {
        username: "user1",
        password: "newPassword123"
      });
      expect(loginRes.statusCode).toEqual(200);
      expect(loginRes.body.token).toBeDefined();

      const oldLoginRes = await req.post("/passport/login", {
        username: "user1",
        password: "password1"
      });
      expect(oldLoginRes.statusCode).toEqual(401);

      user1Token = loginRes.body.token;
    });

    it("should fail when trying to update not allowed fields", async () => {
      const res = await req.put(
        `/passport/user/${user1._id}/self`,
        {
          password: "anotherPassword",
          bannedUntil: new Date(Date.now() + 10000).toISOString()
        },
        {
          Authorization: `USER ${user1Token}`
        }
      );

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toEqual("must NOT have additional properties 'bannedUntil'");
    });

    it("should fail when trying to update another user's password", async () => {
      const res = await req.put(
        `/passport/user/${user2._id}/self`,
        {
          password: "hackedPassword"
        },
        {
          Authorization: `USER ${user1Token}`
        }
      );

      expect(res.statusCode).toEqual(403);

      const loginRes = await req.post("/passport/login", {
        username: "user2",
        password: "password2"
      });
      expect(loginRes.statusCode).toEqual(200);

      const hackedLoginRes = await req.post("/passport/login", {
        username: "user2",
        password: "hackedPassword"
      });
      expect(hackedLoginRes.statusCode).toEqual(401);
      expect(hackedLoginRes.body.message).toEqual("Username or password was incorrect.");
    });
  });

  describe("user administrative updates", () => {
    it("should allow identity to update user's fields without restriction", async () => {
      const banUntil = new Date(Date.now() + 86400000).toISOString();

      const res = await req.put(
        `/passport/user/${user2._id}`,
        {
          bannedUntil: banUntil
        },
        {
          Authorization: `IDENTITY ${adminToken}`
        }
      );
      expect(res.statusCode).toEqual(200);
      expect(res.body._id).toEqual(user2._id);
      expect(res.body.bannedUntil).toBeDefined();
    });

    it("should allow identity to update username and password", async () => {
      const res = await req.put(
        `/passport/user/${user2._id}`,
        {
          username: "user2updated",
          password: "newPassword456"
        },
        {
          Authorization: `IDENTITY ${adminToken}`
        }
      );

      expect(res.statusCode).toEqual(200);
      expect(res.body.username).toEqual("user2updated");

      const loginRes = await req.post("/passport/login", {
        username: "user2updated",
        password: "newPassword456"
      });
      expect(loginRes.statusCode).toEqual(200);
    });
  });
});
