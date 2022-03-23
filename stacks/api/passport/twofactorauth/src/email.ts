import * as nodemailer from "nodemailer";
import {Factor, FactorMeta, FactorSchema, TwoFactorAuthSchemaProvider} from "./interface";

export const EmailFactorSchemaProvider: TwoFactorAuthSchemaProvider = () => {
  const schema: FactorSchema = {
    type: "email",
    title: "Email",
    description: "Security code verification via email.",
    config: {
      address: {
        type: "string"
      }
    }
  };
  return Promise.resolve(schema);
};

export interface EmailFactorMeta extends FactorMeta {
  type: "email";
  config: {
    address: string;
  };
}

export class Email implements Factor {
  readonly name = "email";

  private transporter;
  private code;
  meta: EmailFactorMeta;

  constructor(meta: EmailFactorMeta) {
    this.meta = meta;

    this.transporter = nodemailer.createTransport({
      direct: true,
      host: "smtp.yandex.com",
      port: 465,
      auth: {
        user: "noreply@spicaengine.com",
        pass: "*****"
      },
      secure: true
    });
  }

  getMeta(): FactorMeta {
    return this.meta;
  }

  start() {
    this.code = this.generateRandomCode(5);

    return this.transporter
      .sendMail({
        from: "noreply@spicaengine.com", // sender address
        to: this.meta.email, // list of receivers
        subject: "Your 2FA Code", // Subject line
        text: this.code // plain text body
      })
      .then(
        () =>
          `Please enter the code that has been sent to the '${this.meta.email}'. Do not forget the checking spam folder.`
      );
  }

  authenticate(code: string) {
    return Promise.resolve(code == this.code);
  }

  private generateRandomCode(digit: number) {
    return "12345";
  }
}
