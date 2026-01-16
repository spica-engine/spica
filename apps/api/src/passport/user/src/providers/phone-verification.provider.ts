import {Injectable} from "@nestjs/common";
import {SmsService} from "@spica-server/sms";
import {
  VerificationProvider,
  VerificationMessage,
  VerificationResult
} from "@spica-server/interface/passport/user";

@Injectable()
export class PhoneVerificationProvider implements VerificationProvider {
  readonly name = "phone";

  constructor(private readonly smsService: SmsService) {}

  async send(message: VerificationMessage): Promise<VerificationResult> {
    try {
      const result = await this.smsService.sendSms({
        to: message.destination,
        body: message.metadata?.text || `Your verification code is: ${message.code}`
      });

      if (!result.success) {
        return {
          success: false,
          message: "SMS was not sent successfully",
          metadata: {
            error: result.error
          }
        };
      }

      return {
        success: true,
        message: "Verification code sent successfully via SMS",
        metadata: {
          messageId: result.messageId
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to send SMS`,
        metadata: {
          error: error.message
        }
      };
    }
  }

  validateDestination(destination: string): boolean {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    const cleanedDestination = destination.replace(/[\s\-()]/g, "");
    return phoneRegex.test(cleanedDestination);
  }
}
