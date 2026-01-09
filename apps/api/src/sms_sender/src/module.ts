import {DynamicModule, Global, Module} from "@nestjs/common";
import {SMS_SENDER_OPTIONS, SmsSenderOptions} from "@spica-server/interface/sms_sender";
import {SmsSenderService} from "./service";
import {TwilioStrategy} from "./strategy";
import {DatabaseService} from "@spica-server/database";

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
        TwilioStrategy,
        {
          provide: SmsSenderService,
          useFactory: (database: DatabaseService, twilioStrategy: TwilioStrategy) => {
            const service = new SmsSenderService(database);
            service.registerStrategy(twilioStrategy);
            return service;
          },
          inject: [DatabaseService, TwilioStrategy]
        }
      ],
      exports: [SmsSenderService]
    };
  }
}
