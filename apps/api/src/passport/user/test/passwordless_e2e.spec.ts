import {Test, TestingModule} from "@nestjs/testing";
import {INestApplication} from "@nestjs/common";
import {DatabaseService, DatabaseTestingModule} from "@spica-server/database/testing";
import {PasswordlessService} from "@spica-server/passport/user/src/services/passwordless.service";
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
  let passwordlessService: PasswordlessService;
  let userConfigService: UserConfigService;
  let userService: UserService;
  let db: DatabaseService;
  let container: any;
  let smtpPort: number;
  let apiPort: number;
  let apiHost: string;

  const testEmail = "passwordless@example.com";
  const testUsername = "passwordlessuser";
  const STRATEGY = "otp";
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
          userRealtime: false,
          verificationHashSecret: "3fe2e8060da06c70906096b43db6de11",
          providerEncryptionSecret: "3fe2e8060da06c70906096b43db6de11",
          verificationCodeExpiresIn: 300
        })
      ]
    }).compile();

    passwordlessService = module.get(PasswordlessService);
    userService = module.get(UserService);
    db = module.get(DatabaseService);
    userConfigService = module.get(UserConfigService);

    await userConfigService.set({
      verificationProcessMaxAttempt: 3
    });

    await userConfigService.updatePasswordlessLoginConfig({
      isActive: true,
      provider: EMAIL_PROVIDER
    });

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
    await userService.insertOne({
      username: testUsername,
      password: "hashedpassword",
      policies: [],
      lastPasswords: [],
      failedAttempts: [],
      email: {
        value: testEmail,
        verified: true,
        createdAt: new Date()
      }
    } as any);
  });

  afterEach(async () => {
    await db.collection("verification").deleteMany({});
    await db.collection("user").deleteMany({});
    await db.collection("refresh_token").deleteMany({});

    try {
      await fetch(`http://${apiHost}:${apiPort}/api/v1/messages`, {method: "DELETE"});
    } catch (e) {
      console.warn("Failed to clear MailHog messages:", e);
    }
  });

  describe("Passwordless Login Flow", () => {
    it("should successfully complete passwordless login with correct code", async () => {
      const startResponse = await req.post("/passport/user/passwordless/start", {
        username: testUsername,
        strategy: STRATEGY,
        value: testEmail
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

      const verifyResponse = await req.post("/passport/user/passwordless/verify", {
        username: testUsername,
        strategy: STRATEGY,
        code
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
      const startResponse = await req.post("/passport/user/passwordless/start", {
        username: testUsername,
        strategy: STRATEGY,
        value: testEmail
      });

      expect(startResponse.statusCode).toBe(201);
      expect(startResponse.body).toMatchObject({
        message: expect.stringContaining("successfully")
      });

      const resp = await fetch(`http://${apiHost}:${apiPort}/api/v2/messages`);
      const body: any = await resp.json();

      expect(body.total).toBeGreaterThan(0);

      const wrongCode = "000000";
      const verifyResponse = await req.post("/passport/user/passwordless/verify", {
        username: testUsername,
        strategy: STRATEGY,
        code: wrongCode
      });

      expect(verifyResponse.statusCode).toBe(400);
      expect(verifyResponse.body.message).toContain("Failed to complete passwordless login");
    });
  });
});
