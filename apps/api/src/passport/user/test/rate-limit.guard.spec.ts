import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {RateLimitService} from "@spica-server/passport/user/src/rate-limit.service";
import {RateLimitGuard} from "@spica-server/passport/user/src/rate-limit.guard";
import {UserConfigService} from "@spica-server/passport/user/src/config.service";
import {CoreTestingModule} from "@spica-server/core/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECT_ID} from "@spica-server/core/schema/formats";
import {UserModule} from "@spica-server/passport/user";
import {PolicyModule} from "@spica-server/passport/policy";
import {ConfigModule} from "@spica-server/config";
import {MailerModule, MailerService} from "@spica-server/mailer";
import {SmsModule, SmsService} from "@spica-server/sms";
import {ExecutionContext, HttpException, HttpStatus} from "@nestjs/common";

describe("RateLimitService", () => {
  let module: TestingModule;
  let rateLimitService: RateLimitService;
  let userConfigService: UserConfigService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({formats: [OBJECT_ID]}),
        DatabaseTestingModule.replicaSet(),
        CoreTestingModule,
        PassportTestingModule.initialize(),
        PreferenceTestingModule,
        MailerModule.forRoot({
          host: "test",
          port: 587,
          secure: false,
          auth: {user: "test", pass: "test"}
        }),
        SmsModule.forRoot({
          strategy: "twilio",
          twilio: {
            accountSid: "ACtest",
            authToken: "test",
            fromNumber: "+1234567890"
          }
        }),
        PolicyModule.forRoot({realtime: false}),
        ConfigModule.forRoot(),
        UserModule.forRoot({
          expiresIn: 3600,
          issuer: "test",
          audience: "test",
          maxExpiresIn: 7200,
          secretOrKey: "test-secret",
          passwordHistoryLimit: 0,
          blockingOptions: {blockDurationMinutes: 0, failedAttemptLimit: 0},
          refreshTokenExpiresIn: 604800,
          userRealtime: false,
          verificationHashSecret: "3fe2e8060da06c70906096b43db6de11",
          providerEncryptionSecret: "3fe2e8060da06c70906096b43db6de11",
          providerHashSecret: "3fe2e8060da06c70906096b43db6de11",
          verificationCodeExpiresIn: 300
        })
      ]
    })
      .overrideProvider(MailerService)
      .useValue({sendMail: jest.fn()})
      .overrideProvider(SmsService)
      .useValue({sendSms: jest.fn()})
      .compile();

    rateLimitService = module.get(RateLimitService);
    userConfigService = module.get(UserConfigService);

    rateLimitService.resetTracker();
  });

  afterEach(async () => {
    await module.close();
  });

  describe("when no rate limit config exists", () => {
    it("should allow all requests", () => {
      const result = rateLimitService.checkLimit("login", "192.168.1.1");
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(0);
    });
  });

  describe("when rate limit config is set via setConfigCache", () => {
    beforeEach(() => {
      rateLimitService.setConfigCache({
        login: {limit: 3, ttl: 60_000}
      });
    });

    it("should allow requests within the limit", () => {
      const result1 = rateLimitService.checkLimit("login", "192.168.1.1");
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(2);

      const result2 = rateLimitService.checkLimit("login", "192.168.1.1");
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(1);

      const result3 = rateLimitService.checkLimit("login", "192.168.1.1");
      expect(result3.allowed).toBe(true);
      expect(result3.remaining).toBe(0);
    });

    it("should reject requests exceeding the limit", () => {
      rateLimitService.checkLimit("login", "192.168.1.1");
      rateLimitService.checkLimit("login", "192.168.1.1");
      rateLimitService.checkLimit("login", "192.168.1.1");

      const result = rateLimitService.checkLimit("login", "192.168.1.1");
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should track different IPs independently", () => {
      rateLimitService.checkLimit("login", "192.168.1.1");
      rateLimitService.checkLimit("login", "192.168.1.1");
      rateLimitService.checkLimit("login", "192.168.1.1");
      const resultIp1 = rateLimitService.checkLimit("login", "192.168.1.1");
      expect(resultIp1.allowed).toBe(false);

      const resultIp2 = rateLimitService.checkLimit("login", "10.0.0.1");
      expect(resultIp2.allowed).toBe(true);
      expect(resultIp2.remaining).toBe(2);
    });

    it("should track different groups independently", () => {
      rateLimitService.setConfigCache({
        login: {limit: 2, ttl: 60_000},
        forgotPassword: {limit: 5, ttl: 60_000}
      });

      rateLimitService.checkLimit("login", "192.168.1.1");
      rateLimitService.checkLimit("login", "192.168.1.1");
      const loginResult = rateLimitService.checkLimit("login", "192.168.1.1");
      expect(loginResult.allowed).toBe(false);

      const forgotResult = rateLimitService.checkLimit("forgotPassword", "192.168.1.1");
      expect(forgotResult.allowed).toBe(true);
      expect(forgotResult.remaining).toBe(4);
    });

    it("should allow requests for unconfigured groups", () => {
      const result = rateLimitService.checkLimit("refreshToken", "192.168.1.1");
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(0);
    });

    it("should reset counter after TTL window expires", () => {
      jest.useFakeTimers();
      rateLimitService.setConfigCache({
        login: {limit: 2, ttl: 60_000 * 5}
      });

      rateLimitService.checkLimit("login", "192.168.1.1");
      rateLimitService.checkLimit("login", "192.168.1.1");
      const blocked = rateLimitService.checkLimit("login", "192.168.1.1");
      expect(blocked.allowed).toBe(false);

      jest.advanceTimersByTime(5 * 60_000);

      const afterReset = rateLimitService.checkLimit("login", "192.168.1.1");
      expect(afterReset.allowed).toBe(true);
      expect(afterReset.remaining).toBe(1);
      jest.useRealTimers();
    });

    it("should return correct resetAt timestamp", () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const now = Date.now();

      const result = rateLimitService.checkLimit("login", "192.168.1.1");

      expect(result.resetAt).toBe(now + 1 * 60_000);
      jest.useRealTimers();
    });
  });

  describe("getGroupConfig", () => {
    it("should return undefined when no config cache exists", () => {
      rateLimitService.setConfigCache(undefined);
      expect(rateLimitService.getGroupConfig("login")).toBeUndefined();
    });

    it("should return group config when set", () => {
      rateLimitService.setConfigCache({login: {limit: 10, ttl: 60_000}});
      expect(rateLimitService.getGroupConfig("login")).toEqual({limit: 10, ttl: 60_000});
    });

    it("should return undefined for unconfigured group", () => {
      rateLimitService.setConfigCache({login: {limit: 10, ttl: 60_000}});
      expect(rateLimitService.getGroupConfig("refreshToken")).toBeUndefined();
    });
  });

  describe("config loading from database", () => {
    it("should load config from database on init", async () => {
      await userConfigService.set({
        verificationProcessMaxAttempt: 5,
        rateLimits: {
          login: {limit: 10, ttl: 60_000 * 2}
        }
      });

      await rateLimitService.onModuleInit();

      expect(rateLimitService.getGroupConfig("login")).toEqual({limit: 10, ttl: 60_000 * 2});
    });

    it("should update config cache when config changes via change stream", async () => {
      await rateLimitService.onModuleInit();
      expect(rateLimitService.getGroupConfig("login")).toBeUndefined();

      await userConfigService.set({
        verificationProcessMaxAttempt: 5,
        rateLimits: {
          login: {limit: 5, ttl: 60_000}
        }
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(rateLimitService.getGroupConfig("login")).toEqual({limit: 5, ttl: 60_000});
    });
  });

  describe("resetTracker", () => {
    it("should clear all tracking data", () => {
      rateLimitService.setConfigCache({login: {limit: 2, ttl: 60_000}});
      rateLimitService.checkLimit("login", "1.1.1.1");
      rateLimitService.checkLimit("login", "1.1.1.1");

      rateLimitService.resetTracker();

      const result = rateLimitService.checkLimit("login", "1.1.1.1");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });
  });
});

describe("RateLimitGuard", () => {
  let rateLimitService: RateLimitService;
  let mockResponse: any;
  let mockRequest: any;

  beforeEach(() => {
    rateLimitService = new RateLimitService({} as any);
    mockResponse = {
      setHeader: jest.fn()
    };
    mockRequest = {
      ip: "127.0.0.1"
    };
  });

  function createMockContext(): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse
      })
    } as unknown as ExecutionContext;
  }

  it("should allow request when no config for group", () => {
    rateLimitService.setConfigCache(undefined);
    const GuardClass = RateLimitGuard("login");
    const guard = new GuardClass(rateLimitService);
    const context = createMockContext();

    expect(guard.canActivate(context)).toBe(true);
    expect(mockResponse.setHeader).not.toHaveBeenCalled();
  });

  it("should allow request when under limit and set headers", () => {
    rateLimitService.setConfigCache({login: {limit: 5, ttl: 60_000}});
    const GuardClass = RateLimitGuard("login");
    const guard = new GuardClass(rateLimitService);
    const context = createMockContext();

    expect(guard.canActivate(context)).toBe(true);
    expect(mockResponse.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", 5);
    expect(mockResponse.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 4);
    expect(mockResponse.setHeader).toHaveBeenCalledWith("X-RateLimit-Reset", expect.any(Number));
  });

  it("should throw 429 when limit exceeded", () => {
    rateLimitService.setConfigCache({login: {limit: 2, ttl: 60_000}});
    const GuardClass = RateLimitGuard("login");
    const guard = new GuardClass(rateLimitService);
    const context = createMockContext();

    guard.canActivate(context);
    guard.canActivate(context);

    expect(() => guard.canActivate(context)).toThrow(HttpException);

    try {
      guard.canActivate(context);
    } catch (e) {
      expect(e.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(e.getResponse().message).toBe("Too many requests. Please try again later.");
    }
  });

  it("should set Retry-After header on 429 response", () => {
    rateLimitService.setConfigCache({login: {limit: 1, ttl: 60_000}});
    const GuardClass = RateLimitGuard("login");
    const guard = new GuardClass(rateLimitService);
    const context = createMockContext();

    guard.canActivate(context);

    try {
      guard.canActivate(context);
    } catch (e) {
      expect(mockResponse.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(Number));
    }
  });

  it("should handle different groups independently", () => {
    rateLimitService.setConfigCache({
      login: {limit: 1, ttl: 60_000},
      forgotPassword: {limit: 1, ttl: 60_000}
    });

    const LoginGuard = RateLimitGuard("login");
    const ForgotGuard = RateLimitGuard("forgotPassword");
    const loginGuard = new LoginGuard(rateLimitService);
    const forgotGuard = new ForgotGuard(rateLimitService);
    const context = createMockContext();

    loginGuard.canActivate(context);
    expect(() => loginGuard.canActivate(context)).toThrow(HttpException);

    expect(forgotGuard.canActivate(context)).toBe(true);
  });
});
