import {Test, TestingModule} from "@nestjs/testing";
import {SmsService} from "../src/service";
import {SmsStrategy, SmsSender} from "@spica-server/interface/sms";
import {TwilioStrategy} from "../src/strategy/twilio.strategy";
import {InternalServerErrorException} from "@nestjs/common";

describe("SmsService", () => {
  let service: SmsService;
  let twilioStrategy: TwilioStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: SmsStrategy,
          useValue: {
            validateConfig: jest.fn().mockReturnValue(true),
            send: jest.fn(),
            providerName: "twilio"
          }
        },
        SmsService
      ]
    }).compile();

    service = module.get(SmsService);
    twilioStrategy = module.get(SmsStrategy);
  });

  describe("SMS Sending", () => {
    it("should successfully send SMS", async () => {
      (twilioStrategy.send as jest.Mock).mockResolvedValue({
        success: true,
        messageId: "SM123456789"
      });

      const sms: SmsSender = {
        to: "+1234567890",
        body: "Test message"
      };

      const result = await service.sendSms(sms);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe("SM123456789");
      expect(twilioStrategy.send).toHaveBeenCalledWith(sms);
    });

    it("should throw error when config is invalid", async () => {
      (twilioStrategy.validateConfig as jest.Mock).mockReturnValue(false);

      const sms: SmsSender = {
        to: "+1234567890",
        body: "Test message"
      };

      await expect(service.sendSms(sms)).rejects.toThrow(InternalServerErrorException);
      await expect(service.sendSms(sms)).rejects.toThrow("SMS service is not properly configured");
    });
  });
});
