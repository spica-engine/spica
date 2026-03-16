import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {PassportModule} from "@spica-server/passport";
import {INestApplication} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core/schema";
import {DATE_TIME, OBJECT_ID} from "@spica-server/core/schema/formats";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {UserConfigService} from "../src/config.service";
import {RateLimitService} from "../src/rate-limit.service";
import {ConfigModule} from "@spica-server/config";
import {NestExpressApplication} from "@nestjs/platform-express";

describe("Rate Limit E2E", () => {
  let module: TestingModule;
  let app: NestExpressApplication;
  let req: Request;
  let userConfigService: UserConfigService;
  let rateLimitService: RateLimitService;
  let adminToken: string;

  const ip1 = {"X-Forwarded-For": "1.2.3.4"};

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({formats: [OBJECT_ID, DATE_TIME]}),
        DatabaseTestingModule.replicaSet(),
        PreferenceTestingModule,
        CoreTestingModule,
        ConfigModule.forRoot(),
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
            defaultIdentityPolicies: [
              "UserFullAccess",
              "IdentityFullAccess",
              "PolicyFullAccess",
              "ConfigFullAccess"
            ],
            blockingOptions: {blockDurationMinutes: 0, failedAttemptLimit: 0},
            refreshTokenExpiresIn: 60000,
            passwordHistoryLimit: 0,
            identityRealtime: false,
            refreshTokenHashSecret: "9fe2e8060da06c70906096b43db6de88"
          },
          userOptions: {
            expiresIn: 60000,
            maxExpiresIn: 60000,
            issuer: "spica",
            secretOrKey: "spica",
            audience: "spica",
            blockingOptions: {blockDurationMinutes: 0, failedAttemptLimit: 0},
            refreshTokenExpiresIn: 60000,
            passwordHistoryLimit: 0,
            userRealtime: false,
            providerEncryptionSecret: "3fe2e8060da06c70906096b43db6de11",
            providerHashSecret: "8fe2e8060da06c70906096b43db6de99",
            refreshTokenHashSecret: "9fe2e8060da06c70906096b43db6de88"
          }
        })
      ]
    }).compile();

    app = module.createNestApplication<NestExpressApplication>();
    app.getHttpAdapter().getInstance().set("trust proxy", true);
    req = module.get(Request);
    userConfigService = module.get(UserConfigService);
    rateLimitService = module.get(RateLimitService);

    await app.listen(req.socket);
    await new Promise(resolve => setTimeout(resolve, 3000));

    adminToken = await req
      .post("/passport/identify", {identifier: "spica", password: "spica"})
      .then(res => res.body.token);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("login rate limiting", () => {
    beforeEach(async () => {
      rateLimitService.resetTracker();
      rateLimitService.setConfigCache({login: {limit: 3, ttl: 60_000}});
    });

    it("should reject login request after exceeding configured rate limit", async () => {
      for (let i = 0; i < 3; i++) {
        const res = await req.post(
          "/passport/login",
          {username: "nonexistent", password: "wrongpassword"},
          ip1
        );
        expect(res.headers["x-ratelimit-limit"]).toBe("3");
      }

      const blockedRes = await req.post(
        "/passport/login",
        {username: "nonexistent", password: "wrongpassword"},
        ip1
      );

      expect(blockedRes.statusCode).toBe(429);
      expect(blockedRes.body.message).toBe("Too many requests. Please try again later.");
      expect(blockedRes.headers["retry-after"]).toBeDefined();
      expect(blockedRes.headers["x-ratelimit-remaining"]).toBe("0");
    });

    it("should allow requests again after tracker is reset", async () => {
      rateLimitService.setConfigCache({login: {limit: 2, ttl: 60_000}});
      rateLimitService.resetTracker();

      await req.post("/passport/login", {username: "nonexistent", password: "wrongpassword"}, ip1);
      await req.post("/passport/login", {username: "nonexistent", password: "wrongpassword"}, ip1);

      const blockedRes = await req.post(
        "/passport/login",
        {username: "nonexistent", password: "wrongpassword"},
        ip1
      );
      expect(blockedRes.statusCode).toBe(429);

      rateLimitService.resetTracker();

      const allowedRes = await req.post(
        "/passport/login",
        {username: "nonexistent", password: "wrongpassword"},
        ip1
      );
      expect(allowedRes.statusCode).not.toBe(429);
    });
  });

  describe("rate limit config changes via API", () => {
    beforeEach(async () => {
      rateLimitService.resetTracker();
      rateLimitService.setConfigCache(undefined);
    });

    it("should apply rate limit changes from config", async () => {
      const noLimitRes = await req.post(
        "/passport/login",
        {username: "nonexistent", password: "wrongpassword"},
        ip1
      );
      expect(noLimitRes.headers["x-ratelimit-limit"]).toBeUndefined();

      await userConfigService.set({
        verificationProcessMaxAttempt: 5,
        rateLimits: {login: {limit: 2, ttl: 60_000}}
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      rateLimitService.resetTracker();
      await req.post("/passport/login", {username: "nonexistent", password: "wrongpassword"}, ip1);
      await req.post("/passport/login", {username: "nonexistent", password: "wrongpassword"}, ip1);

      const blockedRes = await req.post(
        "/passport/login",
        {username: "nonexistent", password: "wrongpassword"},
        ip1
      );
      expect(blockedRes.statusCode).toBe(429);
    });

    it("should remove rate limiting when config is cleared", async () => {
      rateLimitService.setConfigCache({login: {limit: 1, ttl: 60_000}});

      await req.post("/passport/login", {username: "nonexistent", password: "wrongpassword"}, ip1);

      const blockedRes = await req.post(
        "/passport/login",
        {username: "nonexistent", password: "wrongpassword"},
        ip1
      );
      expect(blockedRes.statusCode).toBe(429);

      rateLimitService.setConfigCache(undefined);
      rateLimitService.resetTracker();

      const allowedRes = await req.post(
        "/passport/login",
        {username: "nonexistent", password: "wrongpassword"},
        ip1
      );
      expect(allowedRes.statusCode).not.toBe(429);
    });
  });

  describe("create user rate limiting", () => {
    beforeEach(async () => {
      rateLimitService.resetTracker();
      rateLimitService.setConfigCache({createUser: {limit: 2, ttl: 60_000}});
    });

    it("should reject create user after exceeding rate limit", async () => {
      await req.post(
        "/passport/user",
        {username: "user1", password: "Pass1234!"},
        {Authorization: `IDENTITY ${adminToken}`, ...ip1}
      );
      await req.post(
        "/passport/user",
        {username: "user2", password: "Pass1234!"},
        {Authorization: `IDENTITY ${adminToken}`, ...ip1}
      );

      const blockedRes = await req.post(
        "/passport/user",
        {username: "user3", password: "Pass1234!"},
        {Authorization: `IDENTITY ${adminToken}`, ...ip1}
      );
      expect(blockedRes.statusCode).toBe(429);
    });
  });

  describe("refresh token rate limiting", () => {
    beforeEach(async () => {
      rateLimitService.resetTracker();
      rateLimitService.setConfigCache({refreshToken: {limit: 2, ttl: 60_000}});
    });

    it("should reject refresh token after exceeding rate limit", async () => {
      await req.post("/passport/user/session/refresh", undefined, ip1);
      await req.post("/passport/user/session/refresh", undefined, ip1);

      const blockedRes = await req.post("/passport/user/session/refresh", undefined, ip1);
      expect(blockedRes.statusCode).toBe(429);
    });
  });
});
