import {Injectable, InternalServerErrorException} from "@nestjs/common";
import {SmsSender, SmsStrategy, SmsSendResult} from "@spica-server/interface/sms";

@Injectable()
export class SmsService {
  constructor(private readonly strategy: SmsStrategy) {}

  async sendSms(sms: SmsSender): Promise<SmsSendResult> {
    if (!this.strategy.validateConfig()) {
      throw new InternalServerErrorException(
        "SMS service is not properly configured. Please check your the SMS service credentials."
      );
    }
    return await this.strategy.send(sms);
  }
}
