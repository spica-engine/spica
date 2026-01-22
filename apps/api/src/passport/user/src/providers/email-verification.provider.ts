import {Injectable} from "@nestjs/common";
import {MailerService} from "@spica-server/mailer";
import {
  VerificationProvider,
  VerificationMessage,
  VerificationResult
} from "@spica-server/interface/passport/user";

@Injectable()
export class EmailVerificationProvider implements VerificationProvider {
  readonly name = "email";

  constructor(private readonly mailerService: MailerService) {}

  async send(message: VerificationMessage): Promise<VerificationResult> {
    try {
      const result = await this.mailerService.sendMail({
        to: message.destination,
        subject: message.metadata?.subject || "Spica verification code",
        text: message.metadata?.text || `Your verification code is: ${message.code}`
      });

      const success =
        result.accepted?.length > 0 && (!result.rejected || result.rejected.length === 0);

      if (!success) {
        return {
          success: false,
          message: "Email was not accepted by SMTP server",
          metadata: {
            accepted: result.accepted,
            rejected: result.rejected
          }
        };
      }

      return {
        success: true,
        message: "Verification code sent successfully via email",
        metadata: {
          messageId: result.messageId
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to send email`,
        metadata: {
          error: error.message
        }
      };
    }
  }

  validateDestination(destination: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(destination);
  }
}
