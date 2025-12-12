import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseService, DatabaseTestingModule} from "@spica-server/database/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {PassportModule} from "@spica-server/passport";
import {INestApplication} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECT_ID, DATE_TIME} from "@spica-server/core/schema/formats";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

describe("User Ban Logic (banned_until)", () => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;
  let testUserId: string;
  let identityToken: string;
  let userToken: string;
  const EXPIRES_IN = 60_000;

  beforeEach(async () => {
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
            expiresIn: 60400,
            maxExpiresIn: EXPIRES_IN,
            issuer: "spica",
            secretOrKey: "spica",
            audience: "spica",
            defaultIdentityIdentifier: "spica",
            defaultIdentityPassword: "spica",
            defaultIdentityPolicies: [
              "ApiKeyFullAccess",
              "BucketFullAccess",
              "IdentityFullAccess",
              "PassportFullAccess",
              "PolicyFullAccess",
              "UserFullAccess"
            ],
            blockingOptions: {
              failedAttemptLimit: 3,
              blockDurationMinutes: 10
            },
            refreshTokenExpiresIn: 60 * 60 * 24 * 3,
            passwordHistoryLimit: 2,
            identityRealtime: false
          },
          userOptions: {
            expiresIn: EXPIRES_IN,
            maxExpiresIn: EXPIRES_IN,
            issuer: "spica",
            secretOrKey: "spica",
            audience: "spica",
            defaultUserUsername: "testuser",
            defaultUserPassword: "password123",
            defaultUserPolicies: [],
            blockingOptions: {
              failedAttemptLimit: 3,
              blockDurationMinutes: 10
            },
            refreshTokenExpiresIn: 60 * 60 * 24 * 3,
            passwordHistoryLimit: 2,
            userRealtime: false
          }
        })
      ]
    }).compile();

    app = module.createNestApplication();
    req = module.get(Request);
    await app.listen(req.socket);

    // Wait longer for default identity to be created
    await new Promise(resolve => setTimeout(resolve, 3000));

    const identityLoginRes = await req.post("/passport/identify", {
      identifier: "spica",
      password: "spica"
    });
    identityToken = identityLoginRes.body.token;
    testUserId = await req
      .get(
        `/passport/user`,
        {
          username: "testuser"
        },
        {
          Authorization: `IDENTITY ${identityToken}`
        }
      )
      .then(res => res.body[0]._id);

    const userLoginRes = await req.post("/passport/login", {
      username: "testuser",
      password: "password123"
    });
    userToken = userLoginRes.body.token;
  });

  afterEach(() => app.close());

  describe("Login", () => {
    it("should allow normal login when user is not banned", async () => {
      const loginRes = await req.post("/passport/login", {
        username: "testuser",
        password: "password123"
      });

      expect(loginRes.statusCode).toEqual(200);
      expect(loginRes.body.token).toBeDefined();
    });

    it("should reject login when user is banned and show banned message", async () => {
      // Ban the user for 1 hour
      const bannedUntil = new Date();
      bannedUntil.setHours(bannedUntil.getHours() + 1);

      const getUserRes = await req.get(
        `/passport/user/${testUserId}`,
        {},
        {
          Authorization: `IDENTITY ${identityToken}`
        }
      );

      await req.put(
        `/passport/user/${testUserId}`,
        {
          username: getUserRes.body.username,
          banned_until: bannedUntil
        },
        {Authorization: `IDENTITY ${identityToken}`}
      );

      const loginRes = await req.post(
        "/passport/login",
        {
          username: "testuser",
          password: "password123"
        },
        {Authorization: `USER ${userToken}`}
      );

      expect(loginRes.statusCode).toEqual(401);
      expect(loginRes.body.message).toContain("User is banned.");
    });

    it("should allow login after ban expires using fake timers", async () => {
      jest.useFakeTimers({
        doNotFake: ["nextTick", "setImmediate", "clearImmediate", "setInterval", "clearInterval"]
      });
      const now = new Date();
      jest.setSystemTime(now);

      // Ban the user for 1 hour
      const bannedUntil = new Date(now);
      bannedUntil.setHours(bannedUntil.getHours() + 1);

      const getUserRes = await req.get(
        `/passport/user/${testUserId}`,
        {},
        {
          Authorization: `IDENTITY ${identityToken}`
        }
      );

      await req.put(
        `/passport/user/${testUserId}`,
        {
          username: getUserRes.body.username,
          banned_until: bannedUntil
        },
        {Authorization: `IDENTITY ${identityToken}`}
      );

      let loginRes = await req.post("/passport/login", {
        username: "testuser",
        password: "password123"
      });

      expect(loginRes.statusCode).toEqual(401);
      expect(loginRes.body.message).toContain("User is banned.");

      // Advance time by 2 hours
      jest.advanceTimersByTime(2 * 60 * 60 * 1000);

      loginRes = await req.post("/passport/login", {
        username: "testuser",
        password: "password123"
      });

      expect(loginRes.statusCode).toEqual(200);
      expect(loginRes.body.token).toBeDefined();

      jest.useRealTimers();
    });
  });
});
