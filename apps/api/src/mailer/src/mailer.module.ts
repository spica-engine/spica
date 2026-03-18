import {DynamicModule, Global, Module} from "@nestjs/common";
import {MAILER_OPTIONS, MailerOptions} from "@spica-server/interface/mailer";
import {MailerService} from "./mailer.service";

@Global()
@Module({})
export class MailerModule {
  static forRoot(options: MailerOptions): DynamicModule {
    return {
      module: MailerModule,
      providers: [
        {
          provide: MAILER_OPTIONS,
          useValue: options
        },
        MailerService
      ],
      exports: [MailerService]
    };
  }
}
