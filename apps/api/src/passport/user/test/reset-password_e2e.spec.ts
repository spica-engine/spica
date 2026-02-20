import {Test, TestingModule} from "@nestjs/testing";
import {INestApplication} from "@nestjs/common";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {UserService} from "@spica-server/passport/user/src/user.service";
import {MailerService} from "@spica-server/mailer";
import {MailerModule} from "@spica-server/mailer";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECT_ID} from "@spica-server/core/schema/formats";
import {PassportModule} from "@spica-server/passport";
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
  let container: any;
  let smtpPort: number;
  let apiPort: number;
  let apiHost: string;

  const STRATEGY = "Otp";
  const EMAIL_PROVIDER = "email";
  const wrongCode = "999999";

  const username = "testuser";
  const email = "test@example.com";
  const oldPassword = "oldPassword123";
  const newPassword = "newPassword456";

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
        PreferenceTestingModule,
        MailerModule.forRoot({
          host: smtpHost,
          port: smtpPort,
          secure: false,
          defaults: {
            from: "noreply@spica.internal"
          }
        }),
        PassportModule.forRoot({
          publicUrl: `http://${apiHost}:${apiPort}`,
          defaultStrategy: "USER",
          identityOptions: {
            expiresIn: 3600,
            maxExpiresIn: 7200,
            issuer: "test",
            audience: "test-audience",
            secretOrKey: "test-secret",
            refreshTokenExpiresIn: 7200,
            blockingOptions: {
              blockDurationMinutes: 0,
              failedAttemptLimit: 0
            },
            identityRealtime: false,
            passwordHistoryLimit: 3,
            defaultIdentityIdentifier: "spica",
            defaultIdentityPassword: "spica",
            defaultIdentityPolicies: ["UserFullAccess", "IdentityFullAccess", "PolicyFullAccess"]
          },
          userOptions: {
            expiresIn: 3600,
            issuer: "test",
            audience: "test-audience",
            maxExpiresIn: 7200,
            secretOrKey: "test-secret",
            refreshTokenExpiresIn: 7200,
            passwordHistoryLimit: 3,
            blockingOptions: {
              blockDurationMinutes: 0,
              failedAttemptLimit: 0
            },
            userRealtime: false,
            verificationHashSecret: "3fe2e8060da06c70906096b43db6de11",
            providerEncryptionSecret: "3fe2e8060da06c70906096b43db6de11",
            verificationCodeExpiresIn: 300
          },
          policyRealtime: false,
          apikeyRealtime: false,
          refreshTokenRealtime: false,
          samlCertificateTTL: 604800
        })
      ]
    }).compile();

    userService = module.get(UserService);
    mailerService = module.get(MailerService);
    userConfigService = module.get(UserConfigService);

    await userConfigService.set({
      verificationProcessMaxAttempt: 3,
      resetPasswordProvider: [
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

    const encryptedEmail = userService.encryptField(email);
    await userService.insertOne({
      username: username,
      password: oldPassword,
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
  }, 60000);

  afterEach(async () => {
    if (app) await app.close();
    if (module) await module.close();
    if (container) await container.stop();
  });

  describe("Complete password reset flow", () => {
    it("should successfully reset password with correct verification code", async () => {
      const startResponse = await req.post("/passport/user/forgot-password/start", {
        username,
        provider: EMAIL_PROVIDER
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
        newPassword,
        provider: EMAIL_PROVIDER
      });

      expect(resetResponse.statusCode).toBe(201);
      expect(resetResponse.body).toEqual({
        message: "Password has been reset successfully. You can now log in with your new password."
      });

      const loginResponse = await req.post("/passport/login", {
        username: username,
        password: newPassword
      });

      expect(loginResponse.statusCode).toBe(200);
      expect(loginResponse.body.token).toBeDefined();
    });

    it("should fail password reset with wrong verification code", async () => {
      const startResponse = await req.post("/passport/user/forgot-password/start", {
        username,
        provider: EMAIL_PROVIDER
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
        newPassword,
        provider: EMAIL_PROVIDER
      });

      expect(resetResponse.statusCode).toBe(400);
      expect(resetResponse.body.message).toBe("Failed to reset password.");

      const loginResponse = await req.post("/passport/login", {
        username: username,
        password: newPassword
      });

      expect(loginResponse.statusCode).toBe(401);
      expect(loginResponse.body.token).toBeUndefined();
      expect(loginResponse.body.message).toBe("Username or password was incorrect.");
    });
  });
});
