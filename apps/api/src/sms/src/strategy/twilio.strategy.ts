import {SmsSender, SmsStrategy, SmsSendResult, TwilioConfig} from "@spica-server/interface/sms";
import {InternalServerErrorException, Logger} from "@nestjs/common";
import twilio from "twilio";

export class TwilioStrategy extends SmsStrategy {
  private readonly logger = new Logger(TwilioStrategy.name);
  private config: TwilioConfig;
  private client: twilio.Twilio;

  constructor(accountSid: string, authToken: string, fromNumber: string) {
    super();
    this.config = {
      accountSid,
      authToken,
      fromNumber
    };
    this.initializeClient();
  }

  validateConfig(): boolean {
    return !!(this.config.accountSid && this.config.authToken && this.config.fromNumber);
  }

  async send(sms: SmsSender): Promise<SmsSendResult> {
    const fromNumber = sms.from || this.config.fromNumber;

    try {
      const message = await this.client.messages.create({
        body: sms.body,
        to: sms.to,
        from: fromNumber
      });

      return {
        success: true,
        messageId: message.sid
      };
    } catch (error) {
      this.logger.error(
        "Error sending SMS via Twilio:",
        error instanceof Error ? error.stack : String(error)
      );
      throw new InternalServerErrorException("Failed to send SMS via Twilio");
    }
  }

  private initializeClient(): void {
    if (this.validateConfig()) {
      this.client = twilio(this.config.accountSid, this.config.authToken);
    }
  }
}
