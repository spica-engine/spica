import {Test, TestingModule} from "@nestjs/testing";
import {HttpException} from "@nestjs/common";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {CoreTestingModule} from "@spica-server/core-testing";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {PreferenceTestingModule} from "@spica-server/preference-testing";
import {SchemaModule, OBJECT_ID} from "@spica-server/core-schema";
import {MailerModule, MailerService} from "@spica-server/mailer";
import {SmsModule, SmsService} from "@spica-server/sms";
import {PolicyModule} from "@spica-server/passport-policy";
import {ConfigModule} from "@spica-server/config";
import {UserModule} from "@spica-server/passport-user";
import {UserService} from "@spica-server/passport-user/src/user.service";

/**
 * Login attempt blocking — there was **no test at all** for it on the `user` side (D13).
 *
 * The gap was expensive: `isUserBlocked` wrote
 * `failedAttempts.filter(attempt => attempt > lastLogin)` and, when `lastLogin` is absent, that is always
 * false, so the account is never blocked. On MongoDB it worked through two accidents lining up (the
 * driver turns `undefined` into `null`, and `Date > null` coerces `null` to 0); once R51 stopped writing
 * an undefined `lastLogin`, blocking broke silently **on both backends** and no test saw it.
 *
 * This spec is deliberately at the service level: the blocking decision is made in `UserService.login`
 * and can be verified independently of the HTTP layer.
 */
describe("UserService — login attempt blocking", () => {
  let module: TestingModule;
  let userService: UserService;

  const username = "blocked-user";
  const password = "correct-horse";
  const failedAttemptLimit = 3;

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
          twilio: {accountSid: "ACtest", authToken: "test", fromNumber: "+1234567890"}
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
          blockingOptions: {blockDurationMinutes: 10, failedAttemptLimit},
          refreshTokenExpiresIn: 604800,
          refreshTokenHashSecret: "refresh_token_hash_secret",
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

    userService = module.get(UserService);

    // `default()` hashes the password; `insertOne` would store it raw and `compare` would never match.
    await userService.default({
      username,
      password,
      policies: [],
      lastPasswords: [],
      failedAttempts: []
    } as any);
  });

  afterEach(async () => {
    await module.close();
  });

  const failOnce = () => userService.login(username, "wrong-password");

  it("the 401 behaviour until the limit is reached: it returns null and does not raise", async () => {
    for (let attempt = 0; attempt < failedAttemptLimit - 1; attempt++) {
      await expect(failOnce()).resolves.toBeNull();
    }
  });

  /**
   * What this test catches: an account that has never logged in successfully has to be blocked too. In
   * the absence of `lastLogin` the comparison silently produced an empty set.
   */
  it("an account that has never logged in successfully is blocked at the limit too", async () => {
    for (let attempt = 0; attempt < failedAttemptLimit - 1; attempt++) {
      await failOnce();
    }

    await expect(failOnce()).rejects.toThrow(HttpException);
  });

  it("even the CORRECT password is not accepted once blocked", async () => {
    for (let attempt = 0; attempt < failedAttemptLimit - 1; attempt++) {
      await failOnce();
    }
    await failOnce().catch(() => {});

    await expect(userService.login(username, password)).rejects.toThrow(/Too many failed login/);
  });

  it("a successful login resets the counter", async () => {
    await failOnce();
    await expect(userService.login(username, password)).resolves.toMatchObject({username});

    const user = await userService.findOne({username});
    expect(user.failedAttempts).toEqual([]);
    expect(user.lastLogin).toBeInstanceOf(Date);
  });
});
