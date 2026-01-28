import {Test, TestingModule} from "@nestjs/testing";
import {INestApplication} from "@nestjs/common";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {VerificationService} from "@spica-server/passport/user/src/verification.service";
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

describe("Provider Verification E2E with MailHog", () => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;
  let verificationService: VerificationService;
  let userConfigService: UserConfigService;
  let userService: UserService;
  let mailerService: MailerService;
  let db: DatabaseService;
  let container: any;
  let smtpPort: number;
  let apiPort: number;
  let apiHost: string;
  let testUserId: ObjectId;

  const wrongCode = "999999";
  const STRATEGY = "Otp";
  const PURPOSE = "verify";
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
          maxExpiresIn: 7200,
          secretOrKey: "test-secret",
          passwordHistoryLimit: 0,
          blockingOptions: {
            blockDurationMinutes: 0,
            failedAttemptLimit: 0
          },
          userRealtime: false,
          hashSecret: "test-hash-secret",
          verificationCodeExpiresIn: 300
        })
      ]
    }).compile();

    verificationService = module.get(VerificationService);
    userService = module.get(UserService);
    mailerService = module.get(MailerService);
    db = module.get(DatabaseService);
    userConfigService = module.get(UserConfigService);
    req = module.get(Request);

    userConfigService.set({
      verificationProcessMaxAttempt: 3
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
    testUserId = new ObjectId();
    await userService.insertOne({
      _id: testUserId,
      username: "testuser",
      password: "testpassword"
    } as any);
  });

  afterEach(async () => {
    await db.collection("verification").deleteMany({});
    await db.collection("user").deleteMany({});
  });

  describe("Complete provider email verification flow", () => {
    it("should successfully verify user with correct code sent via email", async () => {
      const email = "test@example.com";

      const startResponse = await req.post(
        `/passport/user/${testUserId}/start-provider-verification`,
        {
          value: email,
          provider: EMAIL_PROVIDER,
          strategy: STRATEGY,
          purpose: PURPOSE
        }
      );

      expect(startResponse.statusCode).toBe(201);
      expect(startResponse.body).toMatchObject({
        message: expect.stringContaining("successfully"),
        value: email
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

      const verification = await verificationService.findOne({
        userId: testUserId,
        provider: EMAIL_PROVIDER
      });

      expect(verification).toMatchObject({
        userId: testUserId,
        destination: email,
        purpose: PURPOSE,
        is_used: false
      });

      const verifyResponse = await req.post(`/passport/user/${testUserId}/verify-provider`, {
        code,
        provider: EMAIL_PROVIDER,
        strategy: STRATEGY,
        purpose: PURPOSE
      });

      expect(verifyResponse.statusCode).toBe(201);
      expect(verifyResponse.body).toEqual({
        destination: email,
        message: "Verification completed successfully",
        provider: EMAIL_PROVIDER
      });

      const updatedVerification = await verificationService.findOne({_id: verification._id});

      expect(updatedVerification.is_used).toBe(true);

      const userResponse = await req.get(`/passport/user/${testUserId}`);

      expect(userResponse.body.email).toEqual({
        value: email,
        createdAt: userResponse.body.email.createdAt
      });
    });

    it("should fail verification when user enters wrong code", async () => {
      const email = "wrongcode@example.com";

      const startResponse = await req.post(
        `/passport/user/${testUserId}/start-provider-verification`,
        {
          value: email,
          provider: EMAIL_PROVIDER,
          strategy: STRATEGY,
          purpose: PURPOSE
        }
      );

      expect(startResponse.statusCode).toBe(201);
      expect(startResponse.body).toMatchObject({
        message: expect.stringContaining("successfully"),
        value: email
      });

      const resp = await fetch(`http://${apiHost}:${apiPort}/api/v2/messages`);
      const body: any = await resp.json();

      expect(body.total).toBeGreaterThan(0);

      const verification = await verificationService.findOne({
        userId: testUserId,
        provider: EMAIL_PROVIDER
      });

      expect(verification).toMatchObject({
        userId: testUserId,
        destination: email,
        purpose: PURPOSE,
        is_used: false
      });

      const verifyResponse = await req.post(`/passport/user/${testUserId}/verify-provider`, {
        code: wrongCode,
        provider: EMAIL_PROVIDER,
        strategy: STRATEGY,
        purpose: PURPOSE
      });

      expect(verifyResponse.statusCode).toBe(400);
      expect(verifyResponse.body.message).toBe("Invalid verification code");

      const updatedVerification = await verificationService.findOne({_id: verification._id});

      expect(updatedVerification.is_used).toBe(true);

      const userResponse = await req.get(`/passport/user/${testUserId}`);

      expect(userResponse.body.email).toBeUndefined();
    });

    it("should reject invalid email format", async () => {
      const invalidEmail = "not-an-email";

      const startResponse = await req.post(
        `/passport/user/${testUserId}/start-provider-verification`,
        {
          value: invalidEmail,
          provider: EMAIL_PROVIDER,
          strategy: STRATEGY,
          purpose: PURPOSE
        }
      );

      expect(startResponse.statusCode).toBe(400);
      expect(startResponse.body.message).toContain("Invalid destination format");

      const resp = await fetch(`http://${apiHost}:${apiPort}/api/v2/messages`);
      const body: any = await resp.json();

      expect(body.total).toBe(0);
    });

    it("should fail when attempting verification a second time", async () => {
      const email = "maxattempts@example.com";

      const startResponse = await req.post(
        `/passport/user/${testUserId}/start-provider-verification`,
        {
          value: email,
          provider: EMAIL_PROVIDER,
          strategy: STRATEGY,
          purpose: PURPOSE
        }
      );

      expect(startResponse.statusCode).toBe(201);
      expect(startResponse.body).toMatchObject({
        message: expect.stringContaining("successfully"),
        value: email
      });

      const verification = await verificationService.findOne({
        userId: testUserId,
        provider: EMAIL_PROVIDER
      });

      expect(verification).toMatchObject({
        userId: testUserId,
        destination: email,
        purpose: PURPOSE,
        is_used: false
      });

      const firstVerifyResponse = await req.post(`/passport/user/${testUserId}/verify-provider`, {
        code: wrongCode,
        provider: EMAIL_PROVIDER,
        strategy: STRATEGY,
        purpose: PURPOSE
      });

      expect(firstVerifyResponse.statusCode).toBe(400);
      expect(firstVerifyResponse.body.message).toBe("Invalid verification code");

      const updatedVerification = await verificationService.findOne({_id: verification._id});

      expect(updatedVerification.is_used).toBe(true);

      const secondVerifyResponse = await req.post(`/passport/user/${testUserId}/verify-provider`, {
        code: wrongCode,
        provider: EMAIL_PROVIDER,
        strategy: STRATEGY,
        purpose: PURPOSE
      });

      expect(secondVerifyResponse.statusCode).toBe(404);
      expect(secondVerifyResponse.body.message).toBe("No verification found");
    });
  });
});
