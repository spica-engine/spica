import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseService, DatabaseTestingModule} from "@spica-server/database/testing";
import {PasswordlessService} from "@spica-server/passport/user/src/services/passwordless.service";
import {UserService} from "@spica-server/passport/user/src/user.service";
import {UserConfigService} from "@spica-server/passport/user/src/config.service";
import {MailerService} from "@spica-server/mailer";
import {MailerModule} from "@spica-server/mailer";
import {SmsModule, SmsService} from "@spica-server/sms";
import {BadRequestException, NotFoundException} from "@nestjs/common";
import {CoreTestingModule} from "@spica-server/core/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECT_ID} from "@spica-server/core/schema/formats";
import {UserModule} from "@spica-server/passport/user";
import {PolicyModule} from "@spica-server/passport/policy";
import {User} from "@spica-server/interface/passport/user";

describe("Passwordless Login", () => {
  let module: TestingModule;
  let passwordlessService: PasswordlessService;
  let userService: UserService;
  let userConfigService: UserConfigService;
  let mailerService: MailerService;
  let smsService: SmsService;
  let db: DatabaseService;

  const mockMailerService = {
    sendMail: jest.fn()
  };

  const mockSmsService = {
    sendSms: jest.fn()
  };

  const testEmail = "test@example.com";
  const testPhone = "+1234567890";
  const username = "testuser";
  const strategy = "otp";
  let maxAttemptCount = 5;

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
    })
      .overrideProvider(MailerService)
      .useValue(mockMailerService)
      .overrideProvider(SmsService)
      .useValue(mockSmsService)
      .compile();

    passwordlessService = module.get(PasswordlessService);
    userService = module.get(UserService);
    userConfigService = module.get(UserConfigService);
    mailerService = module.get(MailerService);
    smsService = module.get(SmsService);
    db = module.get(DatabaseService);

    mockMailerService.sendMail.mockReset();
    mockSmsService.sendSms.mockReset();

    await userConfigService.set({
      verificationProcessMaxAttempt: maxAttemptCount
    });
  });

  afterEach(async () => {
    await db.collection("verification").deleteMany({});
    await db.collection("user").deleteMany({});
    await db.collection("config").deleteMany({});
    await db.collection("refresh_token").deleteMany({});
  });

  describe("startPasswordlessLogin", () => {
    let user: User;

    beforeEach(async () => {
      const encryptedEmail = userService.encryptField(testEmail);
      const encryptedPhone = userService.encryptField(testPhone);

      user = await userService.insertOne({
        username: "testuser",
        password: "hashedpassword",
        policies: [],
        lastPasswords: [],
        failedAttempts: [],
        email: {
          encrypted: encryptedEmail.encrypted,
          iv: encryptedEmail.iv,
          authTag: encryptedEmail.authTag,
          createdAt: new Date()
        },
        phone: {
          encrypted: encryptedPhone.encrypted,
          iv: encryptedPhone.iv,
          authTag: encryptedPhone.authTag,
          createdAt: new Date()
        }
      } as any);

      await userConfigService.updatePasswordlessLoginConfig({
        isActive: true,
        provider: "email"
      });
    });

    it("should throw error when passwordless login is not enabled", async () => {
      await userConfigService.updatePasswordlessLoginConfig({
        isActive: false,
        provider: "email"
      });
      await expect(passwordlessService.start(username, strategy)).rejects.toMatchObject({
        message: expect.stringContaining("Passwordless login is not enabled"),
        status: 400
      });
    });

    it("should send verification code via email when enabled", async () => {
      mockMailerService.sendMail.mockResolvedValue({
        accepted: [testEmail],
        rejected: [],
        messageId: "test-message-id"
      });

      const result = await passwordlessService.start(username, strategy);

      expect(result).toMatchObject({
        message: expect.stringContaining("successfully")
      });

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: testEmail,
        subject: "Spica verification code",
        text: expect.stringContaining("Your verification code for email is:")
      });
    });

    it("should send verification code via phone when enabled", async () => {
      await userConfigService.updatePasswordlessLoginConfig({
        isActive: true,
        provider: "phone"
      });

      mockSmsService.sendSms.mockResolvedValue({
        success: true,
        message: "SMS sent successfully"
      });

      const result = await passwordlessService.start(username, strategy);

      expect(result).toMatchObject({
        message: expect.stringContaining("successfully")
      });

      expect(mockSmsService.sendSms).toHaveBeenCalledWith({
        to: testPhone,
        body: expect.stringContaining("Your verification code for phone is:")
      });
    });

    it("should throw error when user does not exist", async () => {
      try {
        await passwordlessService.start("nonexistent", strategy);
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.message).toContain("No user found with username");
        expect(error.status).toBe(404);
      }
    });

    it("should throw error when sending verification fails", async () => {
      mockMailerService.sendMail.mockRejectedValue(new Error("Send failed"));

      try {
        await passwordlessService.start(username, strategy);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain("Failed to send");
        expect(error.status).toBe(400);
      }
    });
  });

  describe("verifyPasswordlessLogin", () => {
    let user: User;
    const testEmail = "test@example.com";
    const testPhone = "+1234567890";
    let verificationCode: string;

    beforeEach(async () => {
      const encryptedEmail = userService.encryptField(testEmail);
      const encryptedPhone = userService.encryptField(testPhone);

      user = await userService.insertOne({
        username: "testuser",
        password: "hashedpassword",
        policies: [],
        lastPasswords: [],
        failedAttempts: [],
        email: {
          encrypted: encryptedEmail.encrypted,
          iv: encryptedEmail.iv,
          authTag: encryptedEmail.authTag,
          createdAt: new Date()
        },
        phone: {
          encrypted: encryptedPhone.encrypted,
          iv: encryptedPhone.iv,
          authTag: encryptedPhone.authTag,
          createdAt: new Date()
        }
      } as any);

      await userConfigService.updatePasswordlessLoginConfig({
        isActive: true,
        provider: "email"
      });

      mockMailerService.sendMail.mockImplementation(options => {
        const codeMatch = options.text.match(/Your verification code for email is: (\d{6})/);
        if (codeMatch) {
          verificationCode = codeMatch[1];
        }
        return Promise.resolve({
          accepted: [options.to],
          rejected: [],
          messageId: "test-message-id"
        });
      });
    });

    it("should throw error when passwordless login is not enabled", async () => {
      await userConfigService.updatePasswordlessLoginConfig({
        isActive: false,
        provider: "email"
      });

      await expect(passwordlessService.start(username, strategy)).rejects.toMatchObject({
        message: expect.stringContaining("Passwordless login is not enabled"),
        status: 400
      });
    });

    it("should successfully login", async () => {
      await passwordlessService.start(username, strategy);

      const result = await passwordlessService.verify(username, strategy, verificationCode);

      expect(result).toMatchObject({
        token: expect.any(String),
        scheme: "USER",
        issuer: "passport/user",
        refreshToken: expect.any(String)
      });

      expect(result.token).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
    });

    it("should throw error for invalid verification code", async () => {
      await passwordlessService.start(username, strategy);

      try {
        await passwordlessService.verify(username, strategy, "000000");
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain("Failed to complete passwordless login. Please try again.");
        expect(error.status).toBe(400);
      }
    });

    it("should throw error when no verification exists", async () => {
      try {
        await passwordlessService.verify(username, strategy, "123456");
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain("Failed to complete passwordless login. Please try again.");
        expect(error.status).toBe(400);
      }
    });

    it("should throw error when user does not exist", async () => {
      try {
        await passwordlessService.verify("nonexistent", strategy, "123456");
      } catch (error) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(error.message).toContain("No user found with username");
        expect(error.status).toBe(404);
      }
    });

    it("should update last login after successful verification", async () => {
      const beforeLogin = new Date();
      await passwordlessService.start(username, strategy);

      await passwordlessService.verify(username, strategy, verificationCode);

      const updatedUser = await userService.findOne({_id: user._id});
      expect(updatedUser.lastLogin).toBeDefined();
      expect(updatedUser.lastLogin.getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime());
    });

    it("should mark verification as used after successful login", async () => {
      await passwordlessService.start(username, strategy);
      await passwordlessService.verify(username, strategy, verificationCode);
      try {
        await passwordlessService.verify(username, strategy, verificationCode);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toContain("Failed to complete passwordless login. Please try again.");
        expect(error.status).toBe(400);
      }
    });

    it("should work with phone provider", async () => {
      await userConfigService.updatePasswordlessLoginConfig({
        isActive: true,
        provider: "phone"
      });

      mockSmsService.sendSms.mockImplementation(options => {
        const codeMatch = options.body.match(/Your verification code for phone is: (\d{6})/);
        if (codeMatch) {
          verificationCode = codeMatch[1];
        }
        return Promise.resolve({
          success: true,
          message: "SMS sent successfully"
        });
      });

      await passwordlessService.start(username, strategy);

      const result = await passwordlessService.verify(username, strategy, verificationCode);

      expect(result).toMatchObject({
        token: expect.any(String),
        scheme: "USER",
        issuer: "passport/user",
        refreshToken: expect.any(String)
      });
    });
  });
});
