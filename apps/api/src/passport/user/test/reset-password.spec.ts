import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseService, DatabaseTestingModule} from "@spica-server/database/testing";
import {PasswordResetService} from "@spica-server/passport/user/src/services/password-reset.service";
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
import {UserModule, UserService} from "@spica-server/passport/user";
import {PolicyModule} from "@spica-server/passport/policy";
import {compare} from "@spica-server/passport/identity/src/hash";

describe("PasswordResetService", () => {
  let module: TestingModule;
  let passwordResetService: PasswordResetService;
  let userConfigService: UserConfigService;
  let userService: UserService;
  let mailerService: MailerService;
  let smsService: SmsService;
  let db: DatabaseService;
  let maxAttemptCount = 3;

  const STRATEGY = "Otp";
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
    })
      .overrideProvider(MailerService)
      .useValue(mockMailerService)
      .overrideProvider(SmsService)
      .useValue(mockSmsService)
      .compile();

    passwordResetService = module.get(PasswordResetService);
    userConfigService = module.get(UserConfigService);
    userService = module.get(UserService);
    mailerService = module.get(MailerService);
    smsService = module.get(SmsService);
    db = module.get(DatabaseService);
  });

  beforeEach(async () => {
    await userConfigService.set({
      verificationProcessMaxAttempt: maxAttemptCount,
      resetPasswordProvider: EMAIL_PROVIDER
    });
  });

  afterEach(async () => {
    await userService.deleteMany({});
    mockMailerService.sendMail.mockReset();
    mockSmsService.sendSms.mockReset();
  });

  describe("startForgotPasswordProcess", () => {
    it("should start forgot password process for user with email", async () => {
      const username = "testuser";
      const email = "test@example.com";

      const encryptedEmail = userService.encryptField(email);
      await userService.insertOne({
        username,
        password: "oldPassword123",
        email: encryptedEmail
      } as any);

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [email],
        rejected: [],
        messageId: "test-message-id"
      });

      const result = await passwordResetService.startForgotPasswordProcess(
        username,
        EMAIL_PROVIDER,
        STRATEGY
      );

      expect(result).toEqual({
        message: "Reset password verification code sent successfully."
      });

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: email,
        subject: "Spica verification code",
        text: expect.stringContaining(`Your verification code for ${EMAIL_PROVIDER} is:`)
      });
    });

    it("should start forgot password process for user with phone", async () => {
      const username = "testphoneuser";
      const phoneNumber = "+1234567890";

      const encryptedPhone = userService.encryptField(phoneNumber);
      await userService.insertOne({
        username,
        password: "oldPassword123",
        phone: encryptedPhone
      } as any);

      mockSmsService.sendSms.mockResolvedValue({
        success: true,
        messageId: "test-sms-message-id"
      });

      const result = await passwordResetService.startForgotPasswordProcess(
        username,
        PHONE_PROVIDER,
        STRATEGY
      );

      expect(result).toEqual({
        message: "Reset password verification code sent successfully."
      });

      expect(mockSmsService.sendSms).toHaveBeenCalledWith({
        to: phoneNumber,
        body: expect.stringContaining(`Your verification code for ${PHONE_PROVIDER} is:`)
      });
    });

    it("should throw error when user does not exist", async () => {
      const username = "nonexistentuser";

      await expect(
        passwordResetService.startForgotPasswordProcess(username, EMAIL_PROVIDER, STRATEGY)
      ).rejects.toThrow(NotFoundException);

      expect(mockMailerService.sendMail).not.toHaveBeenCalled();
    });

    it("should throw error when user does not have provider", async () => {
      const username = "userwithoutprovider";

      await userService.insertOne({
        username,
        password: "oldPassword123"
      } as any);

      await expect(
        passwordResetService.startForgotPasswordProcess(username, EMAIL_PROVIDER, STRATEGY)
      ).rejects.toThrow(BadRequestException);

      expect(mockMailerService.sendMail).not.toHaveBeenCalled();
    });

    it("should handle email send failure", async () => {
      const username = "testuser";
      const email = "test@example.com";

      const encryptedEmail = userService.encryptField(email);
      await userService.insertOne({
        username,
        password: "oldPassword123",
        email: encryptedEmail
      } as any);

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [],
        rejected: [email]
      });

      await expect(
        passwordResetService.startForgotPasswordProcess(username, EMAIL_PROVIDER, STRATEGY)
      ).rejects.toThrow(BadRequestException);
    });

    it("should handle SMS send failure", async () => {
      const username = "testuser";
      const phoneNumber = "+1234567890";

      const encryptedPhone = userService.encryptField(phoneNumber);
      await userService.insertOne({
        username,
        password: "oldPassword123",
        phone: encryptedPhone
      } as any);

      mockSmsService.sendSms.mockResolvedValue({
        success: false,
        error: "SMS service unavailable"
      });

      await expect(
        passwordResetService.startForgotPasswordProcess(username, PHONE_PROVIDER, STRATEGY)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("verifyAndResetPassword", () => {
    it("should successfully reset password with valid verification code", async () => {
      const username = "testuser";
      const email = "test@example.com";
      const oldPassword = "oldPassword123";
      const newPassword = "newPassword456";

      const encryptedEmail = userService.encryptField(email);
      const user = await userService.insertOne({
        username,
        password: oldPassword,
        email: encryptedEmail
      } as any);

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [email],
        rejected: [],
        messageId: "test-message-id"
      });

      await passwordResetService.startForgotPasswordProcess(username, EMAIL_PROVIDER, STRATEGY);

      const sentEmail = mockMailerService.sendMail.mock.calls[0][0].text;
      const codeMatch = sentEmail.match(/is: (\d{6})/);
      const code = codeMatch[1];

      const resetResult = await passwordResetService.verifyAndResetPassword(
        username,
        code,
        STRATEGY,
        newPassword
      );

      expect(resetResult).toEqual({
        message: "Password has been reset successfully. You can now log in with your new password."
      });

      const updatedUser = await userService.findOne({_id: user._id});
      const isMatch = await compare(newPassword, updatedUser.password);
      expect(isMatch).toBe(true);
    });

    it("should throw error with wrong verification code", async () => {
      const username = "testuser";
      const email = "test@example.com";
      const newPassword = "newPassword456";
      const wrongCode = "999999";

      const encryptedEmail = userService.encryptField(email);
      await userService.insertOne({
        username,
        password: "oldPassword123",
        email: encryptedEmail
      } as any);

      await userConfigService.set({
        verificationProcessMaxAttempt: maxAttemptCount,
        resetPasswordProvider: EMAIL_PROVIDER
      });

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [email],
        rejected: [],
        messageId: "test-message-id"
      });

      await passwordResetService.startForgotPasswordProcess(username, EMAIL_PROVIDER, STRATEGY);

      await expect(
        passwordResetService.verifyAndResetPassword(username, wrongCode, STRATEGY, newPassword)
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw error when verifying non-existent user", async () => {
      const username = "nonexistentuser";
      const code = "123456";
      const newPassword = "newPassword456";

      await expect(
        passwordResetService.verifyAndResetPassword(username, code, STRATEGY, newPassword)
      ).rejects.toThrow(BadRequestException);
    });

    it("should not allow reusing the same verification", async () => {
      const username = "testuser";
      const email = "test@example.com";
      const newPassword = "newPassword456";

      const encryptedEmail = userService.encryptField(email);
      await userService.insertOne({
        username,
        password: "oldPassword123",
        email: encryptedEmail
      } as any);

      mockMailerService.sendMail.mockResolvedValue({
        accepted: [email],
        rejected: [],
        messageId: "test-message-id"
      });

      await passwordResetService.startForgotPasswordProcess(username, EMAIL_PROVIDER, STRATEGY);

      const sentEmail = mockMailerService.sendMail.mock.calls[0][0].text;
      const codeMatch = sentEmail.match(/is: (\d{6})/);
      const code = codeMatch[1];

      await passwordResetService.verifyAndResetPassword(username, code, STRATEGY, newPassword);

      await expect(
        passwordResetService.verifyAndResetPassword(username, code, STRATEGY, newPassword)
      ).rejects.toThrow(BadRequestException);
    });

    it("should successfully reset password using phone provider", async () => {
      const username = "testphoneuser";
      const phoneNumber = "+1234567890";
      const oldPassword = "oldPassword123";
      const newPassword = "newPassword456";

      const encryptedPhone = userService.encryptField(phoneNumber);
      const user = await userService.insertOne({
        username,
        password: oldPassword,
        phone: encryptedPhone
      } as any);

      await userConfigService.set({
        verificationProcessMaxAttempt: maxAttemptCount,
        resetPasswordProvider: PHONE_PROVIDER
      });

      mockSmsService.sendSms.mockResolvedValue({
        success: true,
        messageId: "test-sms-message-id"
      });

      await passwordResetService.startForgotPasswordProcess(username, PHONE_PROVIDER, STRATEGY);

      const sentSms = mockSmsService.sendSms.mock.calls[0][0].body;
      const codeMatch = sentSms.match(/is: (\d{6})/);
      const code = codeMatch[1];

      const resetResult = await passwordResetService.verifyAndResetPassword(
        username,
        code,
        STRATEGY,
        newPassword
      );

      expect(resetResult).toEqual({
        message: "Password has been reset successfully. You can now log in with your new password."
      });

      const updatedUser = await userService.findOne({_id: user._id});
      const isMatch = await compare(newPassword, updatedUser.password);
      expect(isMatch).toBe(true);
    });
  });
});
