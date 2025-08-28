import {Inject, Injectable, Logger} from "@nestjs/common";
import nodemailer, {Transporter} from "nodemailer";
import {MAILER_OPTIONS, MailerOptions, SendMailOptions} from "@spica-server/interface/mailer";

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: Transporter;

  constructor(@Inject(MAILER_OPTIONS) private readonly options: MailerOptions) {
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: options.auth
    });
  }

  async sendMail(mail: SendMailOptions) {
    const message = {
      from: mail.from || this.options.defaults?.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text || "",
      html: mail.html || ""
    };

    try {
      const result = await this.transporter.sendMail(message);
      return result;
    } catch (error) {
      this.logger.error(`Failed to send mail to ${mail.to}: ${error.message}`);
      throw error;
    }
  }
}
