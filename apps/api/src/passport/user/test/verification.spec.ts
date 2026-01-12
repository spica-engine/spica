import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {VerificationService} from "@spica-server/passport/user/src/verification.service";
import {UserService} from "@spica-server/passport/user/src/user.service";
import {MailerService} from "@spica-server/mailer";
import {MailerModule} from "@spica-server/mailer";
import {NotFoundException} from "@nestjs/common";
import {hash} from "@spica-server/core/schema";
import {CoreTestingModule} from "@spica-server/core/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECT_ID} from "@spica-server/core/schema/formats";
import {UserModule} from "@spica-server/passport/user";
import {PolicyModule} from "@spica-server/passport/policy";

describe("Provider Verification", () => {
  let module: TestingModule;
  let verificationService: VerificationService;
  let userService: UserService;
  let mailerService: MailerService;
  let db: DatabaseService;

  const mockMailerService = {
    sendMail: jest.fn()
  };

  beforeEach(async () => {
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
          host: "test",
          port: 587,
          secure: false,
          auth: {user: "test", pass: "test"}
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
          hashSecret: "test-hash-secret"
        })
      ]
    })
      .overrideProvider(MailerService)
      .useValue(mockMailerService)
      .compile();

    verificationService = module.get(VerificationService);
    userService = module.get(UserService);
    mailerService = module.get(MailerService);
    db = module.get(DatabaseService);

    mockMailerService.sendMail.mockReset();
  });

  afterEach(async () => {
    await db.collection("verification").deleteMany({});
    await db.collection("user").deleteMany({});
  });

  describe("start provider verification", () => {
    it("should insert verification code into collection", async () => {
      const userId = new ObjectId();
      const email = "test@example.com";
      const provider = "email";

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [email],
        rejected: []
      });

      const result = await verificationService.startAuthProviderVerification(
        userId,
        email,
        provider
      );

      expect(result).toEqual({
        message: "Verification code sent successfully",
        value: email
      });

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: email,
        subject: "Spica verification code",
        text: expect.stringContaining(`Your verification code for ${provider} is:`)
      });

      const verification = await db.collection("verification").findOne({userId, channel: provider});

      expect(verification).toMatchObject({
        destination: email,
        userId: userId,
        channel: provider,
        purpose: "verify",
        active: true,
        attempts: 0
      });
      expect(verification.code).toBeDefined();
      expect(verification.expiredAt).toBeInstanceOf(Date);
      expect(verification.expiredAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("should throw error when mail is not accepted by SMTP", async () => {
      const userId = new ObjectId();
      const email = "test@example.com";
      const provider = "email";

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [],
        rejected: [email]
      });

      await expect(
        verificationService.startAuthProviderVerification(userId, email, provider)
      ).rejects.toThrow("Mail was not accepted by SMTP");

      const verification = await db.collection("verification").findOne({userId, channel: provider});

      expect(verification).toBeNull();
    });

    it("should deactivate existing active verification before creating new one", async () => {
      const userId = new ObjectId();
      const email = "test@example.com";
      const provider = "email";

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [email],
        rejected: []
      });

      // Create first verification
      await verificationService.startAuthProviderVerification(userId, email, provider);

      const firstVerification = await db
        .collection("verification")
        .findOne({userId, channel: provider, active: true});

      expect(firstVerification).toBeDefined();
      expect(firstVerification.active).toBe(true);

      // Create second verification
      await verificationService.startAuthProviderVerification(userId, email, provider);

      // First verification should now be inactive
      const deactivatedVerification = await db
        .collection("verification")
        .findOne({_id: firstVerification._id});
      expect(deactivatedVerification.active).toBe(false);

      // Second verification should be active
      const activeVerifications = await db
        .collection("verification")
        .find({userId, channel: provider, active: true})
        .toArray();

      expect(activeVerifications).toHaveLength(1);
      expect(activeVerifications[0]._id).not.toEqual(firstVerification._id);
    });

    it("should allow new verification if previous one expired", async () => {
      const userId = new ObjectId();
      const email = "test@example.com";
      const provider = "email";

      // Insert expired verification
      await db.collection("verification").insertOne({
        userId,
        destination: email,
        expiredAt: new Date(Date.now() - 10 * 60 * 1000),
        attempts: 0,
        code: hash("123456", "test-hash-secret"),
        channel: provider,
        purpose: "verify",
        active: true
      });

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [email],
        rejected: []
      });

      // Should succeed and create new verification without deactivating expired one
      // The expired verification won't be found by the query since it filters for expiredAt > now
      await verificationService.startAuthProviderVerification(userId, email, provider);

      const verifications = await db
        .collection("verification")
        .find({userId, channel: provider})
        .toArray();

      expect(verifications).toHaveLength(2);

      // Both have active=true, but only the new one is functionally active (not expired)
      const activeVerifications = verifications.filter(v => v.active);
      expect(activeVerifications).toHaveLength(2);

      // Only one is both active and not expired - the new one
      const nonExpiredActiveVerifications = verifications.filter(
        v => v.active && v.expiredAt > new Date()
      );
      expect(nonExpiredActiveVerifications).toHaveLength(1);
    });
  });

  describe("verify provider", () => {
    let userId: ObjectId;
    let email: string;
    let provider: string;
    let randomCode: string;

    beforeEach(async () => {
      userId = new ObjectId();
      email = "test@example.com";
      provider = "email";
      randomCode = "123456";

      await userService.insertOne({
        _id: userId,
        username: "testuser",
        password: "testpassword"
      } as any);

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [email],
        rejected: []
      });
    });

    it("should verify successfully with correct code", async () => {
      await verificationService.startAuthProviderVerification(userId, email, provider);

      const verification = await db.collection("verification").findOne({userId, channel: provider});

      const sentEmail = mockMailerService.sendMail.mock.calls[0][0].text;
      const codeMatch = sentEmail.match(/is: (\d{6})/);
      const code = codeMatch[1];

      const result = await verificationService.verifyAuthProvider(userId, code, provider);

      expect(result).toEqual({
        message: "Verification completed successfully"
      });

      const updatedVerification = await db
        .collection("verification")
        .findOne({_id: verification._id});
      expect(updatedVerification.active).toBe(false);

      const user = await userService.findOne({_id: userId});
      expect(user.email).toMatchObject({
        value: email,
        verified: true
      });
      expect(user.email.created_at).toBeInstanceOf(Date);
    });

    it("should fail with wrong code", async () => {
      await verificationService.startAuthProviderVerification(userId, email, provider);

      const wrongCode = "9999999";

      await expect(
        verificationService.verifyAuthProvider(userId, wrongCode, provider)
      ).rejects.toThrow("Invalid verification code");

      const verification = await db.collection("verification").findOne({userId, channel: provider});
      expect(verification).toMatchObject({
        active: true,
        attempts: 1
      });

      const user = await userService.findOne({_id: userId});
      expect(user.email).toBeUndefined();
    });

    it("should fail with expired verification", async () => {
      const expiredDate = new Date(Date.now() - 10 * 60 * 1000);

      await db.collection("verification").insertOne({
        userId,
        destination: email,
        expiredAt: expiredDate,
        attempts: 0,
        code: hash(randomCode, "verifyHashSecret"),
        channel: provider,
        purpose: "verify",
        active: true
      });

      await expect(
        verificationService.verifyAuthProvider(userId, randomCode, provider)
      ).rejects.toThrow(NotFoundException);

      const user = await userService.findOne({_id: userId});
      expect(user.email).toBeUndefined();
    });

    it("should fail when attempt count reaches limit", async () => {
      await db.collection("verification").insertOne({
        userId,
        destination: email,
        expiredAt: new Date(Date.now() + 5 * 60 * 1000),
        attempts: 5,
        code: hash(randomCode, "verifyHashSecret"),
        channel: provider,
        purpose: "verify",
        active: true
      });

      await expect(
        verificationService.verifyAuthProvider(userId, randomCode, provider)
      ).rejects.toThrow(NotFoundException);

      const user = await userService.findOne({_id: userId});
      expect(user.email).toBeUndefined();
    });

    it("should fail with wrong userId", async () => {
      await verificationService.startAuthProviderVerification(userId, email, provider);

      const sentEmail = mockMailerService.sendMail.mock.calls[0][0].text;
      const codeMatch = sentEmail.match(/is: (\d{6})/);
      const code = codeMatch[1];

      const wrongUserId = new ObjectId();

      await expect(
        verificationService.verifyAuthProvider(wrongUserId, code, provider)
      ).rejects.toThrow(NotFoundException);

      const verification = await db.collection("verification").findOne({userId, channel: provider});
      expect(verification).toMatchObject({
        active: true,
        attempts: 0
      });
    });

    it("should fail with wrong provider", async () => {
      await verificationService.startAuthProviderVerification(userId, email, provider);

      const sentEmail = mockMailerService.sendMail.mock.calls[0][0].text;
      const codeMatch = sentEmail.match(/is: (\d{6})/);
      const code = codeMatch[1];

      const wrongProvider = "sms";

      await expect(
        verificationService.verifyAuthProvider(userId, code, wrongProvider)
      ).rejects.toThrow(NotFoundException);

      const verification = await db.collection("verification").findOne({userId, channel: provider});
      expect(verification).toMatchObject({
        active: true,
        attempts: 0
      });
    });
  });
});
