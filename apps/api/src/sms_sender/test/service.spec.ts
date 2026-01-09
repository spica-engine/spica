import {Test, TestingModule} from "@nestjs/testing";
import {SmsSenderService} from "../src/service";
import {TwilioStrategy} from "../src/strategy";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {SMS_SENDER_OPTIONS} from "@spica-server/interface/sms_sender";

describe("SmsSenderService", () => {
  let service: SmsSenderService;
  let twilioStrategy: TwilioStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseTestingModule.standalone()],
      providers: [
        SmsSenderService,
        {
          provide: SMS_SENDER_OPTIONS,
          useValue: {
            twilio: {
              accountSid: "ACtest123",
              authToken: "test_token",
              fromNumber: "+14155551234"
            }
          }
        },
        TwilioStrategy
      ]
    }).compile();

    service = module.get<SmsSenderService>(SmsSenderService);
    twilioStrategy = module.get<TwilioStrategy>(TwilioStrategy);

    service.registerStrategy(twilioStrategy);
  });

  afterEach(async () => {
    await service._coll.deleteMany({});
  });

  describe("Strategy Registration", () => {
    it("should register Twilio strategy on initialization", () => {
      const strategy = service.getStrategy("twilio");
      expect(strategy).toBeDefined();
      expect(strategy).toBeInstanceOf(TwilioStrategy);
    });

    it("should return list of supported services", () => {
      const services = service.getSupportedServices();
      expect(services).toContain("twilio");
    });

    it("should check if service is supported", () => {
      expect(service.isServiceSupported("twilio")).toBe(true);
      expect(service.isServiceSupported("nexmo")).toBe(false);
    });
  });

  describe("Twilio Strategy Configuration", () => {
    it("should validate configuration correctly", () => {
      expect(twilioStrategy.validateConfig()).toBe(true);
      expect(twilioStrategy.providerName).toBe("twilio");
    });
  });

  describe("SMS Sending", () => {
    it("should throw error for unsupported service", async () => {
      const sms = {
        to: "+1234567890",
        body: "Test message",
        service: "unsupported"
      };

      await expect(service.sendSms(sms)).rejects.toThrow(
        'SMS service "unsupported" is not supported'
      );
    });

    it("should successfully send SMS and save record", async () => {
      const sendSpy = jest.spyOn(twilioStrategy, "send").mockResolvedValue({
        success: true,
        messageId: "SM123456789",
        provider: "twilio"
      });

      const sms = {
        to: "+1234567890",
        body: "Test message",
        service: "twilio"
      };

      const result = await service.sendSms(sms);

      expect(result).toEqual({
        success: true,
        messageId: "SM123456789",
        provider: "twilio"
      });

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "+1234567890",
          body: "Test message",
          service: "twilio"
        })
      );

      const records = await service.find({to: "+1234567890"});
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        to: "+1234567890",
        body: "Test message",
        service: "twilio",
        messageId: "SM123456789",
        status: "sent"
      });

      sendSpy.mockRestore();
    });

    it("should handle SMS sending failure and save error", async () => {
      const sendSpy = jest.spyOn(twilioStrategy, "send").mockResolvedValue({
        success: false,
        error: "Invalid phone number",
        provider: "twilio"
      });

      const sms = {
        to: "+1234567890",
        body: "Test message",
        service: "twilio" as const
      };

      const result = await service.sendSms(sms);

      expect(result).toEqual({
        success: false,
        error: "Invalid phone number",
        provider: "twilio"
      });

      const records = await service.find({to: "+1234567890"});
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        status: "failed",
        error: "Invalid phone number"
      });

      sendSpy.mockRestore();
    });

    it("should use custom 'from' number when provided", async () => {
      const sendSpy = jest.spyOn(twilioStrategy, "send").mockResolvedValue({
        success: true,
        messageId: "SM999",
        provider: "twilio"
      });

      const sms = {
        to: "+1234567890",
        from: "+14155559999",
        body: "Custom from test",
        service: "twilio" as const
      };

      await service.sendSms(sms);

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "+14155559999"
        })
      );

      sendSpy.mockRestore();
    });

    it("should fail when no 'from' number is available", async () => {
      const strategyWithoutFrom = new TwilioStrategy({
        twilio: {
          accountSid: "ACtest",
          authToken: "token"
        }
      });

      service.registerStrategy(strategyWithoutFrom);

      const sms = {
        to: "+1234567890",
        body: "Test",
        service: "twilio"
      };

      const result = await service.sendSms(sms);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No 'from' phone number provided");
    });
  });
});
