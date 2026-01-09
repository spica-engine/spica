import {Inject, Injectable} from "@nestjs/common";
import {
  SmsSender,
  SmsStrategy,
  SmsSendResult,
  TwilioConfig,
  SMS_SENDER_OPTIONS,
  SmsSenderOptions
} from "@spica-server/interface/sms_sender";
import twilio from "twilio";

@Injectable()
export class TwilioStrategy extends SmsStrategy {
  private config: TwilioConfig;
  private client: twilio.Twilio;

  constructor(@Inject(SMS_SENDER_OPTIONS) options: SmsSenderOptions) {
    super();
    this.config = options.twilio;
    this.initializeClient();
  }

  get providerName(): string {
    return "twilio";
  }

  validateConfig(): boolean {
    return !!(this.config.accountSid && this.config.authToken);
  }

  async send(sms: SmsSender): Promise<SmsSendResult> {
    const fromNumber = sms.from || this.config.fromNumber;
    if (!fromNumber) {
      return {
        success: false,
        error:
          "No 'from' phone number provided. Either set TWILIO_FROM_NUMBER or pass 'from' in the request.",
        provider: "twilio"
      };
    }

    try {
      const message = await this.client.messages.create({
        body: sms.body,
        to: sms.to,
        from: fromNumber
      });

      return {
        success: true,
        messageId: message.sid,
        provider: "twilio"
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || "Failed to send SMS via Twilio",
        provider: "twilio"
      };
    }
  }

  private initializeClient(): void {
    if (this.validateConfig()) {
      this.client = twilio(this.config.accountSid, this.config.authToken);
    }
  }

  setConfig(config: TwilioConfig): void {
    this.config = config;
    this.initializeClient();
  }
}
