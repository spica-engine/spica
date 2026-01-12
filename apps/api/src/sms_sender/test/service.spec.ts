import {Test, TestingModule} from "@nestjs/testing";
import {SmsService} from "../src/service";
import {SmsStrategy, SmsSender} from "@spica-server/interface/sms_sender";
import {TwilioStrategy} from "../src/strategy/twilio.strategy";

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

    it("should handle SMS sending failure", async () => {
      (twilioStrategy.send as jest.Mock).mockRejectedValue(new Error("Some error"));

      const sms: SmsSender = {
        to: "+1234567890",
        body: "Test message"
      };

      const result = await service.sendSms(sms);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to send SMS");
    });
  });
});
