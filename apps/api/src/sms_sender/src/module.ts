import {DynamicModule, Global, Module} from "@nestjs/common";
import {SMS_SENDER_OPTIONS, SmsSenderOptions} from "@spica-server/interface/sms_sender";
import {SmsSenderService} from "./service";
import {TwilioStrategy} from "./strategy";

@Global()
@Module({})
export class SmsSenderModule {
  static forRoot(options: SmsSenderOptions): DynamicModule {
    return {
      module: SmsSenderModule,
      controllers: [],
      providers: [
        {
          provide: SMS_SENDER_OPTIONS,
          useValue: options
        },
        SmsSenderService,
        TwilioStrategy,
        {
          provide: "SMS_STRATEGIES",
          useFactory: (service: SmsSenderService, twilio: TwilioStrategy) => {
            service.registerStrategy(twilio);
            return service;
          },
          inject: [SmsSenderService, TwilioStrategy]
        }
      ],
      exports: [SmsSenderService]
    };
  }
}
