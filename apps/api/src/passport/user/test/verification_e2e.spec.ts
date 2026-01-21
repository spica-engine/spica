import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {VerificationService} from "@spica-server/passport/user/src/verification.service";
import {UserService} from "@spica-server/passport/user/src/user.service";
import {MailerService} from "@spica-server/mailer";
import {MailerModule} from "@spica-server/mailer";
import {CoreTestingModule} from "@spica-server/core/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECT_ID} from "@spica-server/core/schema/formats";
import {UserModule} from "@spica-server/passport/user";
import {PolicyModule} from "@spica-server/passport/policy";
import fetch from "node-fetch";
import {GenericContainer} from "testcontainers";

describe("Verification E2E with MailHog", () => {
  let module: TestingModule;
  let verificationService: VerificationService;
  let userService: UserService;
  let mailerService: MailerService;
  let db: DatabaseService;
  let container: any;
  let smtpPort: number;
  let apiPort: number;
  let apiHost: string;
  let testUserId: ObjectId;
  const wrongCode = "999999";
  beforeAll(async () => {
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
  }, 60000);

  afterAll(async () => {
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

    try {
      await fetch(`http://${apiHost}:${apiPort}/api/v1/messages`, {method: "DELETE"});
    } catch (e) {
      console.warn("Failed to clear MailHog messages:", e);
    }
  });

  describe("Complete verification flow", () => {
    it("should successfully verify user with correct code sent via email", async () => {
      const email = "test@example.com";
      const provider = "email";

      const startResult = await verificationService.startAuthProviderVerification(
        testUserId,
        email,
        provider
      );

      expect(startResult).toMatchObject({
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

      const verification = await db
        .collection("verification")
        .findOne({userId: testUserId, channel: provider});

      expect(verification).toMatchObject({
        userId: testUserId,
        destination: email,
        channel: provider,
        purpose: "verify",
        is_used: false,
        attempts: 0
      });

      const verifyResult = await verificationService.verifyAuthProvider(testUserId, code, provider);

      expect(verifyResult).toEqual({
        message: "Verification completed successfully"
      });

      const updatedVerification = await db
        .collection("verification")
        .findOne({_id: verification._id});

      expect(updatedVerification.is_used).toBe(true);

      const user = await userService.findOne({_id: testUserId});

      expect(user.email).toMatchObject({
        value: email
      });
      expect(user.email.createdAt).toBeInstanceOf(Date);
    });

    it("should fail verification when user enters wrong code", async () => {
      const email = "wrongcode@example.com";
      const provider = "email";

      const startResult = await verificationService.startAuthProviderVerification(
        testUserId,
        email,
        provider
      );

      expect(startResult).toMatchObject({
        message: expect.stringContaining("successfully"),
        value: email
      });

      const resp = await fetch(`http://${apiHost}:${apiPort}/api/v2/messages`);
      const body: any = await resp.json();

      expect(body.total).toBeGreaterThan(0);

      const verification = await db
        .collection("verification")
        .findOne({userId: testUserId, channel: provider});

      expect(verification).toMatchObject({
        userId: testUserId,
        destination: email,
        channel: provider,
        purpose: "verify",
        is_used: false,
        attempts: 0
      });

      await expect(
        verificationService.verifyAuthProvider(testUserId, wrongCode, provider)
      ).rejects.toThrow("Invalid verification code");

      const updatedVerification = await db
        .collection("verification")
        .findOne({_id: verification._id});

      expect(updatedVerification.is_used).toBe(false);
      expect(updatedVerification.attempts).toBe(1);

      const user = await userService.findOne({_id: testUserId});
      expect(user.email).toBeUndefined();
    });

    it("should reject invalid email format", async () => {
      const invalidEmail = "not-an-email";
      const provider = "email";

      await expect(
        verificationService.startAuthProviderVerification(testUserId, invalidEmail, provider)
      ).rejects.toThrow("Invalid destination format");

      const resp = await fetch(`http://${apiHost}:${apiPort}/api/v2/messages`);
      const body: any = await resp.json();

      expect(body.total).toBe(0);
    });

    it("should block verification after passing attempt count with wrong code", async () => {
      const email = "maxattempts@example.com";
      const provider = "email";

      const startResult = await verificationService.startAuthProviderVerification(
        testUserId,
        email,
        provider
      );

      expect(startResult).toMatchObject({
        message: expect.stringContaining("successfully"),
        value: email
      });

      const verification = await db
        .collection("verification")
        .findOne({userId: testUserId, channel: provider});
      expect(verification).toBeDefined();

      const wrongCode = "9999999";

      // Attempt 5 times with wrong code
      // Todo! this value is static should be refactored after attempt count dynamic implementation
      for (let i = 0; i < 5; i++) {
        await expect(
          verificationService.verifyAuthProvider(testUserId, wrongCode, provider)
        ).rejects.toThrow("Invalid verification code");
      }

      const updatedVerification = await db
        .collection("verification")
        .findOne({_id: verification._id});
      expect(updatedVerification.attempts).toBe(5);

      await expect(
        verificationService.verifyAuthProvider(testUserId, wrongCode, provider)
      ).rejects.toThrow("No verification found");

      const finalVerification = await db
        .collection("verification")
        .findOne({_id: verification._id});

      expect(finalVerification.is_used).toBe(false);
      expect(finalVerification.attempts).toBe(5);

      const user = await userService.findOne({_id: testUserId});
      expect(user.email).toBeUndefined();
    });
  });
});
