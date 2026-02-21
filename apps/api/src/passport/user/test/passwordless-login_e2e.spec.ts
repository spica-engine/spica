import {Test, TestingModule} from "@nestjs/testing";
import {INestApplication} from "@nestjs/common";
import {DatabaseService, DatabaseTestingModule} from "@spica-server/database/testing";
import {PasswordlessLoginService} from "@spica-server/passport/user/src/services/passwordless-login.service";
import {UserService} from "@spica-server/passport/user/src/user.service";
import {UserConfigService} from "@spica-server/passport/user/src/config.service";
import {MailerModule} from "@spica-server/mailer";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECT_ID} from "@spica-server/core/schema/formats";
import {UserModule} from "@spica-server/passport/user";
import {PolicyModule} from "@spica-server/passport/policy";
import fetch from "node-fetch";
import {GenericContainer} from "testcontainers";

describe("Passwordless Login E2E with MailHog", () => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;
  let passwordlessService: PasswordlessLoginService;
  let userConfigService: UserConfigService;
  let userService: UserService;
  let db: DatabaseService;
  let container: any;
  let smtpPort: number;
  let apiPort: number;
  let apiHost: string;

  const testEmail = "passwordless@example.com";
  const testUsername = "passwordlessuser";
  const STRATEGY = "Otp";
  const EMAIL_PROVIDER = "email";

  beforeEach(async () => {
    const mailerUrl = process.env.MAILER_URL;
    let smtpHost = "localhost";
    apiHost = "localhost";

    if (mailerUrl) {
      const [smtpUrl, apiUrl] = mailerUrl.split(",");
      const smtpParts = smtpUrl.split("://")[1].split(":");
      const apiParts = apiUrl.split("://")[1].split(":");

      smtpHost = smtpParts[0];
      smtpPort = parseInt(smtpParts[1]);
      apiHost = apiParts[0];
      apiPort = parseInt(apiParts[1]);
    } else {
      try {
        container = await new GenericContainer("mailhog/mailhog")
          .withExposedPorts(1025, 8025)
          .start();
        smtpPort = container.getMappedPort(1025);
        apiPort = container.getMappedPort(8025);
      } catch (e) {
        console.error("Failed to start MailHog container:", e);
        throw e;
      }
    }

    module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID]
        }),
        DatabaseTestingModule.replicaSet(),
        CoreTestingModule,
        PassportTestingModule.initialize(),
        PreferenceTestingModule,
        MailerModule.forRoot({
          host: smtpHost,
          port: smtpPort,
          secure: false,
          defaults: {
            from: "noreply@spica.internal"
          }
        }),
        PolicyModule.forRoot({realtime: false}),
        UserModule.forRoot({
          expiresIn: 3600,
          issuer: "test",
          audience: "test",
          maxExpiresIn: 7200,
          secretOrKey: "test-secret",
          passwordHistoryLimit: 0,
          blockingOptions: {
            blockDurationMinutes: 0,
            failedAttemptLimit: 0
          },
          refreshTokenExpiresIn: 604800,
          refreshTokenHashSecret: "refresh_token_hash_secret",
          userRealtime: false,
          verificationHashSecret: "3fe2e8060da06c70906096b43db6de11",
          providerEncryptionSecret: "3fe2e8060da06c70906096b43db6de11",
          verificationCodeExpiresIn: 300
        })
      ]
    }).compile();

    passwordlessService = module.get(PasswordlessLoginService);
    userService = module.get(UserService);
    db = module.get(DatabaseService);
    userConfigService = module.get(UserConfigService);

    await userConfigService.set({
      verificationProcessMaxAttempt: 3
    });

    await userConfigService.updatePasswordlessLoginConfig({
      passwordlessLoginProvider: [
        {
          provider: EMAIL_PROVIDER,
          strategy: STRATEGY
        }
      ]
    });

    await userConfigService.updateProviderVerificationConfig([
      {provider: EMAIL_PROVIDER, strategy: STRATEGY}
    ]);

    app = module.createNestApplication();
    req = module.get(Request);
    await app.listen(req.socket);
    await app.init();
  }, 60000);

  afterEach(async () => {
    if (app) await app.close();
    if (module) await module.close();
    if (container) await container.stop();
  });

  beforeEach(async () => {
    const encryptedEmail = userService.encryptField(testEmail);

    await userService.insertOne({
      username: testUsername,
      password: "hashedpassword",
      policies: [],
      lastPasswords: [],
      failedAttempts: [],
      email: {
        encrypted: encryptedEmail.encrypted,
        iv: encryptedEmail.iv,
        authTag: encryptedEmail.authTag,
        createdAt: new Date()
      }
    } as any);
  });

  describe("Passwordless Login Flow", () => {
    it("should successfully complete passwordless login with correct code", async () => {
      const startResponse = await req.post("/passport/user/passwordless-login/start", {
        username: testUsername,
        provider: EMAIL_PROVIDER
      });

      expect(startResponse.statusCode).toBe(201);
      expect(startResponse.body).toMatchObject({
        message: expect.stringContaining("successfully")
      });

      const resp = await fetch(`http://${apiHost}:${apiPort}/api/v2/messages`);
      const body: any = await resp.json();

      expect(body.total).toBeGreaterThan(0);
      const item: any = body.items[0];
      expect(item).toBeDefined();

      const raw =
        item.Raw && item.Raw.Data
          ? item.Raw.Data
          : item.Content && item.Content.Body
            ? item.Content.Body
            : "";

      const codeMatch = raw.match(/is: (\d{6})/);
      expect(codeMatch).toBeTruthy();
      const code = codeMatch[1];

      const verifyResponse = await req.post("/passport/user/passwordless-login/verify", {
        username: testUsername,
        code,
        provider: EMAIL_PROVIDER
      });

      expect(verifyResponse.statusCode).toBe(201);
      expect(verifyResponse.body).toMatchObject({
        token: expect.any(String),
        scheme: "USER",
        issuer: "passport/user",
        refreshToken: expect.any(String)
      });

      expect(verifyResponse.body.token).toBeTruthy();
      expect(verifyResponse.body.refreshToken).toBeTruthy();
    });

    it("should fail verification with wrong code", async () => {
      const startResponse = await req.post("/passport/user/passwordless-login/start", {
        username: testUsername,
        provider: EMAIL_PROVIDER
      });

      expect(startResponse.statusCode).toBe(201);
      expect(startResponse.body).toMatchObject({
        message: expect.stringContaining("successfully")
      });

      const resp = await fetch(`http://${apiHost}:${apiPort}/api/v2/messages`);
      const body: any = await resp.json();

      expect(body.total).toBeGreaterThan(0);

      const wrongCode = "000000";
      const verifyResponse = await req.post("/passport/user/passwordless-login/verify", {
        username: testUsername,
        code: wrongCode,
        provider: EMAIL_PROVIDER
      });

      expect(verifyResponse.statusCode).toBe(400);
      expect(verifyResponse.body.message).toContain("Failed to complete passwordless login");
    });

    it("should fail verification when using an already used code", async () => {
      const startResponse = await req.post("/passport/user/passwordless-login/start", {
        username: testUsername,
        provider: EMAIL_PROVIDER
      });

      expect(startResponse.statusCode).toBe(201);
      expect(startResponse.body).toMatchObject({
        message: expect.stringContaining("successfully")
      });

      const resp = await fetch(`http://${apiHost}:${apiPort}/api/v2/messages`);
      const body: any = await resp.json();

      expect(body.total).toBeGreaterThan(0);
      const item: any = body.items[0];
      expect(item).toBeDefined();

      const raw =
        item.Raw && item.Raw.Data
          ? item.Raw.Data
          : item.Content && item.Content.Body
            ? item.Content.Body
            : "";

      const codeMatch = raw.match(/is: (\d{6})/);
      expect(codeMatch).toBeTruthy();
      const code = codeMatch[1];

      const firstVerifyResponse = await req.post("/passport/user/passwordless-login/verify", {
        username: testUsername,
        code,
        provider: EMAIL_PROVIDER
      });

      expect(firstVerifyResponse.statusCode).toBe(201);
      expect(firstVerifyResponse.body).toMatchObject({
        token: expect.any(String),
        scheme: "USER",
        issuer: "passport/user",
        refreshToken: expect.any(String)
      });

      const secondVerifyResponse = await req.post("/passport/user/passwordless-login/verify", {
        username: testUsername,
        code,
        provider: EMAIL_PROVIDER
      });

      expect(secondVerifyResponse.statusCode).toBe(400);
      expect(secondVerifyResponse.body.message).toContain("Failed to complete passwordless login");
    });
  });
});
