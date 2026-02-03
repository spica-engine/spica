import {Test, TestingModule} from "@nestjs/testing";
import {INestApplication} from "@nestjs/common";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {UserService} from "@spica-server/passport/user/src/user.service";
import {MailerService} from "@spica-server/mailer";
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
import {UserConfigService} from "../src/config.service";

describe("Password Reset E2E with MailHog", () => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;
  let userConfigService: UserConfigService;
  let userService: UserService;
  let mailerService: MailerService;
  let db: DatabaseService;
  let container: any;
  let smtpPort: number;
  let apiPort: number;
  let apiHost: string;

  const STRATEGY = "Otp";
  const EMAIL_PROVIDER = "email";
  const wrongCode = "999999";

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
          maxExpiresIn: 7200,
          secretOrKey: "test-secret",
          passwordHistoryLimit: 3,
          blockingOptions: {
            blockDurationMinutes: 0,
            failedAttemptLimit: 0
          },
          userRealtime: false,
          verificationHashSecret: "3fe2e8060da06c70906096b43db6de11",
          providerEncryptionSecret: "3fe2e8060da06c70906096b43db6de11",
          verificationCodeExpiresIn: 300
        })
      ]
    }).compile();

    userService = module.get(UserService);
    mailerService = module.get(MailerService);
    db = module.get(DatabaseService);
    userConfigService = module.get(UserConfigService);

    await userConfigService.set({
      verificationProcessMaxAttempt: 3,
      resetPasswordProvider: EMAIL_PROVIDER
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

  afterEach(async () => {
    await db.collection("verification").deleteMany({});
    await db.collection("user").deleteMany({});

    try {
      await fetch(`http://${apiHost}:${apiPort}/api/v1/messages`, {method: "DELETE"});
    } catch (e) {
      console.warn("Failed to clear MailHog messages:", e);
    }
  });

  describe("Complete password reset flow", () => {
    it("should successfully reset password with correct verification code", async () => {
      const username = "testuser";
      const email = "test@example.com";
      const oldPassword = "oldPassword123";
      const newPassword = "newPassword456";

      const encryptedEmail = userService.encryptField(email);
      await userService.insertOne({
        username,
        password: oldPassword,
        email: encryptedEmail
      } as any);

      const startResponse = await req.post("/passport/user/forgot-password/start", {
        username,
        provider: EMAIL_PROVIDER,
        strategy: STRATEGY
      });

      expect(startResponse.statusCode).toBe(201);
      expect(startResponse.body).toEqual({
        message: "Reset password verification code sent successfully."
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

      const resetResponse = await req.post("/passport/user/forgot-password/verify", {
        username,
        code,
        strategy: STRATEGY,
        newPassword
      });

      expect(resetResponse.statusCode).toBe(201);
      expect(resetResponse.body).toEqual({
        message: "Password has been reset successfully. You can now log in with your new password."
      });

      const user = await userService.findOne({username});
      expect(user.password).not.toBe(oldPassword);
    });

    it("should fail password reset with wrong verification code", async () => {
      const username = "testuser";
      const email = "wrongcode@example.com";
      const oldPassword = "oldPassword123";
      const newPassword = "newPassword456";

      const encryptedEmail = userService.encryptField(email);
      await userService.insertOne({
        username,
        password: oldPassword,
        email: encryptedEmail
      } as any);

      const startResponse = await req.post("/passport/user/forgot-password/start", {
        username,
        provider: EMAIL_PROVIDER,
        strategy: STRATEGY
      });

      expect(startResponse.statusCode).toBe(201);
      expect(startResponse.body).toEqual({
        message: "Reset password verification code sent successfully."
      });

      const resp = await fetch(`http://${apiHost}:${apiPort}/api/v2/messages`);
      const body: any = await resp.json();

      expect(body.total).toBeGreaterThan(0);

      const resetResponse = await req.post("/passport/user/forgot-password/verify", {
        username,
        code: wrongCode,
        strategy: STRATEGY,
        newPassword
      });

      expect(resetResponse.statusCode).toBe(400);
      expect(resetResponse.body.message).toBe("Failed to reset password.");

      const user = await userService.findOne({username});
      expect(user.password).toBe(oldPassword);
    });
  });
});
