import {Injectable} from "@nestjs/common";
import {SmsSender, SmsStrategy, SmsSendResult} from "@spica-server/interface/sms_sender";

@Injectable()
export class SmsService {
  constructor(private readonly strategy: SmsStrategy) {}

  async sendSms(sms: SmsSender): Promise<SmsSendResult> {
    if (!this.strategy.validateConfig()) {
      throw new Error(`SMS service is not properly configured. Please check the configuration.`);
    }

    try {
      const result = await this.strategy.send(sms);
      return result;
    } catch (error) {
      console.error("Error sending SMS:", error);

      return {
        success: false,
        error: "Failed to send SMS"
      };
    }
  }
}
