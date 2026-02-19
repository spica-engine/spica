import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {VerificationService} from "@spica-server/passport/user/src/verification.service";
import {ProviderVerificationService} from "@spica-server/passport/user/src/services/provider.verification.service";
import {UserConfigService} from "@spica-server/passport/user/src/config.service";
import {MailerService} from "@spica-server/mailer";
import {MailerModule} from "@spica-server/mailer";
import {SmsModule, SmsService} from "@spica-server/sms";
import {BadRequestException, NotFoundException} from "@nestjs/common";
import {CoreTestingModule} from "@spica-server/core/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {_, SchemaModule} from "@spica-server/core/schema";
import {OBJECT_ID} from "@spica-server/core/schema/formats";
import {UserModule, UserService} from "@spica-server/passport/user";
import {PolicyModule} from "@spica-server/passport/policy";

describe("VerificationService", () => {
  let module: TestingModule;
  let verificationService: VerificationService;
  let providerVerificationService: ProviderVerificationService;
  let userConfigService: UserConfigService;
  let userService: UserService;
  let mailerService: MailerService;
  let smsService: SmsService;
  let db: DatabaseService;
  let maxAttemptCount = 3;

  const STRATEGY = "Otp";
  const PURPOSE = "verify";
  const EMAIL_PROVIDER = "email";
  const PHONE_PROVIDER = "phone";

  const mockMailerService = {
    sendMail: jest.fn()
  };

  const mockSmsService = {
    sendSms: jest.fn()
  };

  beforeAll(async () => {
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
        SmsModule.forRoot({
          strategy: "twilio",
          twilio: {
            accountSid: "ACtest",
            authToken: "test",
            fromNumber: "+1234567890"
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
          verificationHashSecret: "3fe2e8060da06c70906096b43db6de11",
          providerEncryptionSecret: "3fe2e8060da06c70906096b43db6de11",
          providerHashSecret: "8be2e8060da06c70906096b43db6de99",
          verificationCodeExpiresIn: 300,
          publicUrl: "http://localhost:4200"
        })
      ]
    })
      .overrideProvider(MailerService)
      .useValue(mockMailerService)
      .overrideProvider(SmsService)
      .useValue(mockSmsService)
      .compile();

    verificationService = module.get(VerificationService);
    providerVerificationService = module.get(ProviderVerificationService);
    userConfigService = module.get(UserConfigService);
    userService = module.get(UserService);
    mailerService = module.get(MailerService);
    smsService = module.get(SmsService);
    db = module.get(DatabaseService);

    await userConfigService.set({
      verificationProcessMaxAttempt: maxAttemptCount
    });
  });

  afterEach(async () => {
    await Promise.all([verificationService.deleteMany({}), userService.deleteMany({})]);
    mockMailerService.sendMail.mockReset();
    mockSmsService.sendSms.mockReset();
  });

  describe("OTP - startVerification", () => {
    beforeEach(async () => {
      await userConfigService.updateProviderVerificationConfig([
        {provider: "email", strategy: STRATEGY},
        {provider: "phone", strategy: STRATEGY}
      ]);
    });

    afterEach(async () => {
      await userConfigService.updateProviderVerificationConfig(undefined);
    });

    it("should create verification record and send email for email provider", async () => {
      const userId = new ObjectId();
      const email = "test@example.com";

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [email],
        rejected: [],
        messageId: "test-message-id"
      });

      const result = await verificationService.startVerificationProcess(
        userId,
        email,
        STRATEGY,
        EMAIL_PROVIDER,
        PURPOSE
      );

      expect(result).toMatchObject({
        message: expect.stringContaining("successfully"),
        value: email
      });

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: email,
        subject: "Spica verification code",
        text: expect.stringContaining(`Your verification code for ${EMAIL_PROVIDER} is:`)
      });

      const updatedVerification = await verificationService.findOne({
        userId: userId,
        destination: email
      });

      expect(updatedVerification).toMatchObject({
        userId: userId,
        destination: email,
        is_used: false,
        strategy: STRATEGY,
        provider: EMAIL_PROVIDER,
        purpose: PURPOSE
      });
    });

    it("should create verification record and send SMS for phone provider", async () => {
      const userId = new ObjectId();
      const phoneNumber = "+1234567890";

      mockSmsService.sendSms.mockResolvedValue({
        success: true,
        messageId: "test-sms-message-id"
      });

      const result = await verificationService.startVerificationProcess(
        userId,
        phoneNumber,
        STRATEGY,
        PHONE_PROVIDER,
        PURPOSE
      );

      expect(result).toMatchObject({
        message: expect.stringContaining("successfully"),
        value: phoneNumber
      });

      expect(mockSmsService.sendSms).toHaveBeenCalledWith({
        to: phoneNumber,
        body: expect.stringContaining(`Your verification code for ${PHONE_PROVIDER} is:`)
      });

      const updatedVerification = await verificationService.findOne({
        userId: userId,
        destination: phoneNumber
      });

      expect(updatedVerification).toMatchObject({
        userId: userId,
        destination: phoneNumber,
        is_used: false,
        strategy: STRATEGY,
        provider: PHONE_PROVIDER,
        purpose: PURPOSE
      });
    });

    it("should throw error for invalid email format", async () => {
      const userId = new ObjectId();
      const invalidEmail = "not-an-email";

      await expect(
        verificationService.startVerificationProcess(
          userId,
          invalidEmail,
          STRATEGY,
          EMAIL_PROVIDER,
          PURPOSE
        )
      ).rejects.toThrow(BadRequestException);

      const [mailCalls, verificationRecord] = await Promise.all([
        Promise.resolve(mockMailerService.sendMail.mock.calls.length),
        verificationService.findOne({userId, destination: invalidEmail})
      ]);

      expect(mailCalls).toBe(0);
      expect(verificationRecord).toBeNull();
    });

    it("should throw error for invalid phone number format", async () => {
      const userId = new ObjectId();
      const invalidPhone = "not-a-phone";

      await expect(
        verificationService.startVerificationProcess(
          userId,
          invalidPhone,
          STRATEGY,
          PHONE_PROVIDER,
          PURPOSE
        )
      ).rejects.toThrow(BadRequestException);

      const [smsCalls, verificationRecord] = await Promise.all([
        Promise.resolve(mockSmsService.sendSms.mock.calls.length),
        verificationService.findOne({userId, destination: invalidPhone})
      ]);

      expect(smsCalls).toBe(0);
      expect(verificationRecord).toBeNull();
    });

    it("should throw error for unknown provider", async () => {
      const userId = new ObjectId();
      const email = "test@example.com";
      const unknownProvider = "unknown-provider";

      await expect(
        verificationService.startVerificationProcess(
          userId,
          email,
          STRATEGY,
          unknownProvider,
          PURPOSE
        )
      ).rejects.toThrow(BadRequestException);

      const [mailCalls, verificationRecord] = await Promise.all([
        Promise.resolve(mockMailerService.sendMail.mock.calls.length),
        verificationService.findOne({userId, destination: email})
      ]);

      expect(mailCalls).toBe(0);
      expect(verificationRecord).toBeNull();
    });

    it("should throw error when email is not accepted by SMTP", async () => {
      const userId = new ObjectId();
      const email = "test@example.com";

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [],
        rejected: [email]
      });

      await expect(
        verificationService.startVerificationProcess(
          userId,
          email,
          STRATEGY,
          EMAIL_PROVIDER,
          PURPOSE
        )
      ).rejects.toThrow(BadRequestException);

      const verificationRecord = await verificationService.findOne({userId, destination: email});
      expect(verificationRecord).toBeNull();
    });

    it("should throw error when SMS fails to send", async () => {
      const userId = new ObjectId();
      const phoneNumber = "+1234567890";

      mockSmsService.sendSms.mockResolvedValue({
        success: false,
        error: "SMS service unavailable"
      });

      await expect(
        verificationService.startVerificationProcess(
          userId,
          phoneNumber,
          STRATEGY,
          PHONE_PROVIDER,
          PURPOSE
        )
      ).rejects.toThrow(BadRequestException);

      const verificationRecord = await verificationService.findOne({
        userId,
        destination: phoneNumber
      });
      expect(verificationRecord).toBeNull();
    });

    it("should throw error when verification count exceeds maximum attempts", async () => {
      const userId = new ObjectId();
      const email = "test@example.com";

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [email],
        rejected: [],
        messageId: "test-message-id"
      });

      for (let i = 0; i < maxAttemptCount; i++) {
        const verification = await verificationService.startVerificationProcess(
          userId,
          email,
          STRATEGY,
          EMAIL_PROVIDER,
          PURPOSE
        );

        expect(verification).toMatchObject({
          message: expect.stringContaining("successfully"),
          value: email
        });
      }
      try {
        await verificationService.startVerificationProcess(
          userId,
          email,
          STRATEGY,
          EMAIL_PROVIDER,
          PURPOSE
        );
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain("Too many verification attempts");
      }
    });
  });

  describe("OTP - verifyProvider", () => {
    beforeEach(async () => {
      await userConfigService.updateProviderVerificationConfig([
        {provider: "email", strategy: STRATEGY},
        {provider: "phone", strategy: STRATEGY}
      ]);
    });

    afterEach(async () => {
      await userConfigService.updateProviderVerificationConfig(undefined);
    });

    it("should verify successfully with correct code", async () => {
      const userId = new ObjectId();
      const email = "test@example.com";

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [email],
        rejected: [],
        messageId: "test-message-id"
      });

      const result = await verificationService.startVerificationProcess(
        userId,
        email,
        STRATEGY,
        EMAIL_PROVIDER,
        PURPOSE
      );
      expect(result.message).toContain("Verification code sent successfully");

      const sentEmail = mockMailerService.sendMail.mock.calls[0][0].text;
      const codeMatch = sentEmail.match(/is: (\d{6})/);
      const code = codeMatch[1];

      const updatedVerification = await verificationService.confirmVerificationProcess(
        userId,
        code,
        STRATEGY,
        EMAIL_PROVIDER,
        PURPOSE
      );

      expect(updatedVerification).toMatchObject({
        userId,
        destination: email,
        strategy: STRATEGY,
        provider: EMAIL_PROVIDER
      });

      const finalVerification = await verificationService.findOne({
        userId,
        destination: email
      });
      expect(finalVerification.is_used).toBe(true);
    });

    it("should fail with wrong code and mark verification as used (one-time use)", async () => {
      const userId = new ObjectId();
      const email = "test@example.com";
      const wrongCode = "999999";

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [email],
        rejected: [],
        messageId: "test-message-id"
      });

      await verificationService.startVerificationProcess(
        userId,
        email,
        STRATEGY,
        EMAIL_PROVIDER,
        PURPOSE
      );

      await expect(
        verificationService.confirmVerificationProcess(
          userId,
          wrongCode,
          STRATEGY,
          EMAIL_PROVIDER,
          PURPOSE
        )
      ).rejects.toThrow(BadRequestException);

      const updatedVerification = await verificationService.findOne({userId, destination: email});
      expect(updatedVerification.is_used).toBe(true);
    });

    it("should fail when trying to reuse the same verification", async () => {
      const userId = new ObjectId();
      const email = "test@example.com";

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [email],
        rejected: [],
        messageId: "test-message-id"
      });

      await verificationService.startVerificationProcess(
        userId,
        email,
        STRATEGY,
        EMAIL_PROVIDER,
        PURPOSE
      );

      const sentEmail = mockMailerService.sendMail.mock.calls[0][0].text;
      const codeMatch = sentEmail.match(/is: (\d{6})/);
      const code = codeMatch[1];

      const verification = await verificationService.confirmVerificationProcess(
        userId,
        code,
        STRATEGY,
        EMAIL_PROVIDER,
        PURPOSE
      );

      expect(verification).toMatchObject({
        userId,
        destination: email,
        strategy: STRATEGY,
        provider: EMAIL_PROVIDER
      });

      const updatedVerification = await verificationService.findOne({userId, destination: email});

      expect(updatedVerification.is_used).toBe(true);

      await expect(
        verificationService.confirmVerificationProcess(
          userId,
          code,
          STRATEGY,
          EMAIL_PROVIDER,
          PURPOSE
        )
      ).rejects.toThrow(NotFoundException);

      const finalVerification = await verificationService.findOne({userId, destination: email});
      expect(finalVerification.is_used).toBe(true);
    });

    it("should fail with wrong userId", async () => {
      const userId = new ObjectId();
      const wrongUserId = new ObjectId();
      const email = "test@example.com";

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [email],
        rejected: [],
        messageId: "test-message-id"
      });

      await verificationService.startVerificationProcess(
        userId,
        email,
        STRATEGY,
        EMAIL_PROVIDER,
        PURPOSE
      );

      const sentEmail = mockMailerService.sendMail.mock.calls[0][0].text;
      const codeMatch = sentEmail.match(/is: (\d{6})/);
      const code = codeMatch[1];

      await expect(
        verificationService.confirmVerificationProcess(
          wrongUserId,
          code,
          STRATEGY,
          EMAIL_PROVIDER,
          PURPOSE
        )
      ).rejects.toThrow(NotFoundException);

      const updatedVerification = await verificationService.findOne({userId, destination: email});
      expect(updatedVerification.is_used).toBe(false);
    });

    it("should fail when trying to verify with wrong provider", async () => {
      const userId = new ObjectId();
      const email = "test@example.com";

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [email],
        rejected: [],
        messageId: "test-message-id"
      });

      await verificationService.startVerificationProcess(
        userId,
        email,
        STRATEGY,
        EMAIL_PROVIDER,
        PURPOSE
      );

      const sentEmail = mockMailerService.sendMail.mock.calls[0][0].text;
      const codeMatch = sentEmail.match(/is: (\d{6})/);
      const code = codeMatch[1];

      await expect(
        verificationService.confirmVerificationProcess(
          userId,
          code,
          STRATEGY,
          PHONE_PROVIDER,
          PURPOSE
        )
      ).rejects.toThrow(NotFoundException);

      const updatedVerification = await verificationService.findOne({userId, destination: email});
      expect(updatedVerification.is_used).toBe(false);
    });

    it("should fail when trying to verify with wrong purpose", async () => {
      const userId = new ObjectId();
      const email = "test@example.com";
      const wrongPurpose = "login";

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [email],
        rejected: [],
        messageId: "test-message-id"
      });

      await verificationService.startVerificationProcess(
        userId,
        email,
        STRATEGY,
        EMAIL_PROVIDER,
        PURPOSE
      );

      const sentEmail = mockMailerService.sendMail.mock.calls[0][0].text;
      const codeMatch = sentEmail.match(/is: (\d{6})/);
      const code = codeMatch[1];

      await expect(
        verificationService.confirmVerificationProcess(
          userId,
          code,
          STRATEGY,
          EMAIL_PROVIDER,
          wrongPurpose
        )
      ).rejects.toThrow(NotFoundException);

      const updatedVerification = await verificationService.findOne({userId, destination: email});
      expect(updatedVerification.is_used).toBe(false);
    });

    it("should verify phone provider successfully with correct code", async () => {
      const userId = new ObjectId();
      const phoneNumber = "+1234567890";

      mockSmsService.sendSms.mockResolvedValue({
        success: true,
        messageId: "test-sms-message-id"
      });

      await verificationService.startVerificationProcess(
        userId,
        phoneNumber,
        STRATEGY,
        PHONE_PROVIDER,
        PURPOSE
      );

      const sentSms = mockSmsService.sendSms.mock.calls[0][0].body;
      const codeMatch = sentSms.match(/is: (\d{6})/);
      const code = codeMatch[1];

      const result = await verificationService.confirmVerificationProcess(
        userId,
        code,
        STRATEGY,
        PHONE_PROVIDER,
        PURPOSE
      );

      expect(result).toMatchObject({
        userId,
        destination: phoneNumber,
        verifiedField: expect.any(String),
        strategy: STRATEGY,
        provider: PHONE_PROVIDER
      });

      const finalVerification = await verificationService.findOne({
        userId,
        destination: phoneNumber
      });
      expect(finalVerification.is_used).toBe(true);
    });

    it("should fail phone verification with wrong code", async () => {
      const userId = new ObjectId();
      const phoneNumber = "+1234567890";
      const wrongCode = "999999";

      mockSmsService.sendSms.mockResolvedValue({
        success: true,
        messageId: "test-sms-message-id"
      });

      await verificationService.startVerificationProcess(
        userId,
        phoneNumber,
        STRATEGY,
        PHONE_PROVIDER,
        PURPOSE
      );

      await expect(
        verificationService.confirmVerificationProcess(
          userId,
          wrongCode,
          STRATEGY,
          PHONE_PROVIDER,
          PURPOSE
        )
      ).rejects.toThrow(BadRequestException);

      const updatedVerification = await verificationService.findOne({
        userId,
        destination: phoneNumber
      });
      expect(updatedVerification.is_used).toBe(true);
    });
  });

  describe("OTP - ProviderVerificationService", () => {
    let userId: ObjectId;
    beforeEach(async () => {
      userId = new ObjectId();
      await userService.insertOne({
        _id: userId,
        username: "testphoneuser",
        password: "testpassword"
      } as any);

      await userConfigService.updateProviderVerificationConfig([
        {provider: "email", strategy: STRATEGY},
        {provider: "phone", strategy: STRATEGY}
      ]);
    });

    afterEach(async () => {
      await userConfigService.updateProviderVerificationConfig(undefined);
    });

    it("should successfully verify provider and update user", async () => {
      const email = "test@example.com";

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [email],
        rejected: [],
        messageId: "test-message-id"
      });

      const result = await verificationService.startVerificationProcess(
        userId,
        email,
        STRATEGY,
        EMAIL_PROVIDER,
        PURPOSE
      );
      expect(result.message).toContain("Verification code sent successfully");

      const sentEmail = mockMailerService.sendMail.mock.calls[0][0].text;
      const codeMatch = sentEmail.match(/is: (\d{6})/);
      const code = codeMatch[1];

      const response = await providerVerificationService.validateCredentialsVerification(
        code,
        STRATEGY,
        userId,
        EMAIL_PROVIDER,
        PURPOSE
      );

      expect(response).toMatchObject({
        message: "Verification completed successfully",
        provider: EMAIL_PROVIDER,
        destination: email
      });

      const finalVerification = await verificationService.findOne({
        userId,
        destination: email
      });
      expect(finalVerification.is_used).toBe(true);

      const user = await userService.findOne({_id: userId});

      const UserWithEmail = userService.decryptProviderFields(user);

      expect(UserWithEmail.email).toBe(email);
    });
  });

  describe("MagicLink - VerificationService", () => {
    const MAGIC_LINK_STRATEGY = "MagicLink";

    beforeEach(async () => {
      await userConfigService.updateProviderVerificationConfig([
        {provider: "email", strategy: "MagicLink"},
        {provider: "phone", strategy: "MagicLink"}
      ]);
    });

    afterEach(async () => {
      await userConfigService.updateProviderVerificationConfig(undefined);
    });

    it("should create verification record and send magic link via email", async () => {
      const userId = new ObjectId();
      const email = "magiclink@example.com";

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [email],
        rejected: [],
        messageId: "test-magic-link-id"
      });

      const result = await verificationService.startVerificationProcess(
        userId,
        email,
        MAGIC_LINK_STRATEGY,
        EMAIL_PROVIDER,
        PURPOSE
      );

      expect(result).toMatchObject({
        message: expect.stringContaining("successfully"),
        value: email
      });

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: email,
        subject: expect.stringContaining("verification"),
        text: expect.stringContaining("verify-magic-link?token=")
      });

      const verification = await verificationService.findOne({
        userId,
        destination: email
      });

      expect(verification).toMatchObject({
        userId,
        destination: email,
        is_used: false,
        strategy: MAGIC_LINK_STRATEGY,
        provider: EMAIL_PROVIDER,
        purpose: PURPOSE
      });
    });

    it("should create verification record and send magic link via SMS", async () => {
      const userId = new ObjectId();
      const phone = "+9876543210";

      mockSmsService.sendSms.mockResolvedValue({
        success: true,
        messageId: "test-magic-sms-id"
      });

      const result = await verificationService.startVerificationProcess(
        userId,
        phone,
        MAGIC_LINK_STRATEGY,
        PHONE_PROVIDER,
        PURPOSE
      );

      expect(result).toMatchObject({
        message: expect.stringContaining("successfully"),
        value: phone
      });

      expect(mockSmsService.sendSms).toHaveBeenCalledWith({
        to: phone,
        body: expect.stringContaining("verify-magic-link?token=")
      });

      const verification = await verificationService.findOne({
        userId,
        destination: phone
      });

      expect(verification).toMatchObject({
        userId,
        destination: phone,
        is_used: false,
        strategy: MAGIC_LINK_STRATEGY,
        provider: PHONE_PROVIDER,
        purpose: PURPOSE
      });
    });

    it("should confirm magic link verification with valid token", async () => {
      const userId = new ObjectId();
      const email = "confirm-magic@example.com";

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [email],
        rejected: [],
        messageId: "test-id"
      });

      await verificationService.startVerificationProcess(
        userId,
        email,
        MAGIC_LINK_STRATEGY,
        EMAIL_PROVIDER,
        PURPOSE
      );

      const sentText = mockMailerService.sendMail.mock.calls[0][0].text;
      const tokenMatch = sentText.match(/token=([A-Za-z0-9_-]+)/);
      expect(tokenMatch).toBeTruthy();
      const token = tokenMatch[1];

      const result = await verificationService.confirmMagicLinkVerification(token);

      expect(result).toMatchObject({
        userId,
        destination: email,
        verifiedField: EMAIL_PROVIDER,
        strategy: MAGIC_LINK_STRATEGY,
        provider: EMAIL_PROVIDER
      });

      const verification = await verificationService.findOne({
        userId,
        destination: email
      });
      expect(verification.is_used).toBe(true);
    });

    it("should fail confirmation with tampered token", async () => {
      const userId = new ObjectId();
      const email = "tampered@example.com";

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [email],
        rejected: [],
        messageId: "test-id"
      });

      await verificationService.startVerificationProcess(
        userId,
        email,
        MAGIC_LINK_STRATEGY,
        EMAIL_PROVIDER,
        PURPOSE
      );

      const tamperedToken = "dGhpcyBpcyBub3QgYSB2YWxpZCB0b2tlbg";

      await expect(verificationService.confirmMagicLinkVerification(tamperedToken)).rejects.toThrow(
        BadRequestException
      );
    });

    it("should fail confirmation when token is reused", async () => {
      const userId = new ObjectId();
      const email = "reuse-magic@example.com";

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [email],
        rejected: [],
        messageId: "test-id"
      });

      await verificationService.startVerificationProcess(
        userId,
        email,
        MAGIC_LINK_STRATEGY,
        EMAIL_PROVIDER,
        PURPOSE
      );

      const sentText = mockMailerService.sendMail.mock.calls[0][0].text;
      const tokenMatch = sentText.match(/token=([A-Za-z0-9_-]+)/);
      const token = tokenMatch[1];

      await verificationService.confirmMagicLinkVerification(token);

      await expect(verificationService.confirmMagicLinkVerification(token)).rejects.toThrow(
        NotFoundException
      );
    });

    it("should fail when MagicLink is not enabled for the provider", async () => {
      await userConfigService.updateProviderVerificationConfig([
        {provider: "phone", strategy: "MagicLink"}
      ]);

      const userId = new ObjectId();
      const email = "not-enabled@example.com";

      await expect(
        verificationService.startVerificationProcess(
          userId,
          email,
          MAGIC_LINK_STRATEGY,
          EMAIL_PROVIDER,
          PURPOSE
        )
      ).rejects.toThrow(BadRequestException);

      expect(mockMailerService.sendMail).not.toHaveBeenCalled();
    });

    it("should fail when providerVerificationConfig is not set", async () => {
      await userConfigService.updateProviderVerificationConfig(undefined);

      const userId = new ObjectId();
      const email = "no-config@example.com";

      await expect(
        verificationService.startVerificationProcess(
          userId,
          email,
          MAGIC_LINK_STRATEGY,
          EMAIL_PROVIDER,
          PURPOSE
        )
      ).rejects.toThrow(BadRequestException);

      expect(mockMailerService.sendMail).not.toHaveBeenCalled();
    });

    it("should throw for unknown strategy", async () => {
      const userId = new ObjectId();
      const email = "unknown-strategy@example.com";

      await expect(
        verificationService.startVerificationProcess(
          userId,
          email,
          "UnknownStrategy",
          EMAIL_PROVIDER,
          PURPOSE
        )
      ).rejects.toThrow(BadRequestException);
    });

    it("should enforce max attempts for magic link strategy", async () => {
      const userId = new ObjectId();
      const email = "maxattempt-magic@example.com";

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [email],
        rejected: [],
        messageId: "test-id"
      });

      for (let i = 0; i < maxAttemptCount; i++) {
        await verificationService.startVerificationProcess(
          userId,
          email,
          MAGIC_LINK_STRATEGY,
          EMAIL_PROVIDER,
          PURPOSE
        );
      }

      await expect(
        verificationService.startVerificationProcess(
          userId,
          email,
          MAGIC_LINK_STRATEGY,
          EMAIL_PROVIDER,
          PURPOSE
        )
      ).rejects.toThrow(BadRequestException);
    });

    it("should clean up verification record when email fails to send", async () => {
      const userId = new ObjectId();
      const email = "fail-send@example.com";

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [],
        rejected: [email]
      });

      await expect(
        verificationService.startVerificationProcess(
          userId,
          email,
          MAGIC_LINK_STRATEGY,
          EMAIL_PROVIDER,
          PURPOSE
        )
      ).rejects.toThrow(BadRequestException);

      const verification = await verificationService.findOne({
        userId,
        destination: email
      });
      expect(verification).toBeNull();
    });
  });

  describe("MagicLink - ProviderVerificationService", () => {
    const MAGIC_LINK_STRATEGY = "MagicLink";
    let userId: ObjectId;

    beforeEach(async () => {
      userId = new ObjectId();
      await userService.insertOne({
        _id: userId,
        username: "magiclink-user",
        password: "testpassword"
      } as any);

      await userConfigService.updateProviderVerificationConfig([
        {provider: "email", strategy: "MagicLink"},
        {provider: "phone", strategy: "MagicLink"}
      ]);
    });

    afterEach(async () => {
      await userConfigService.updateProviderVerificationConfig(undefined);
    });

    it("should verify provider via magic link and update user document", async () => {
      const email = "provider-magic@example.com";

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [email],
        rejected: [],
        messageId: "test-id"
      });

      await providerVerificationService.startCredentialsVerification(
        userId,
        email,
        MAGIC_LINK_STRATEGY,
        EMAIL_PROVIDER,
        PURPOSE
      );

      const sentText = mockMailerService.sendMail.mock.calls[0][0].text;
      const tokenMatch = sentText.match(/token=([A-Za-z0-9_-]+)/);
      const token = tokenMatch[1];

      const response = await providerVerificationService.validateCredentialsVerification(
        token,
        MAGIC_LINK_STRATEGY
      );

      expect(response).toMatchObject({
        message: "Verification completed successfully",
        provider: EMAIL_PROVIDER,
        destination: email
      });

      const user = await userService.findOne({_id: userId});
      const decrypted = userService.decryptProviderFields(user);
      expect(decrypted.email).toBe(email);
    });

    it("should verify phone provider via magic link and update user document", async () => {
      const phone = "+1122334455";

      mockSmsService.sendSms.mockResolvedValue({
        success: true,
        messageId: "test-sms-id"
      });

      await providerVerificationService.startCredentialsVerification(
        userId,
        phone,
        MAGIC_LINK_STRATEGY,
        PHONE_PROVIDER,
        PURPOSE
      );

      const sentBody = mockSmsService.sendSms.mock.calls[0][0].body;
      const tokenMatch = sentBody.match(/token=([A-Za-z0-9_-]+)/);
      const token = tokenMatch[1];

      const response = await providerVerificationService.validateCredentialsVerification(
        token,
        MAGIC_LINK_STRATEGY
      );

      expect(response).toMatchObject({
        message: "Verification completed successfully",
        provider: PHONE_PROVIDER,
        destination: phone
      });

      const user = await userService.findOne({_id: userId});
      const decrypted = userService.decryptProviderFields(user);
      expect(decrypted.phone).toBe(phone);
    });
  });
});
