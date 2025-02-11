import {DynamicModule, Global, Module} from "@nestjs/common";
import {attachStatusTrackerFactory, StatusInterceptor} from "./interceptor";
import {StatusOptions, STATUS_OPTIONS, ATTACH_STATUS_TRACKER} from "./interface";
import {StatusService} from "./service";

@Global()
@Module({})
export class CoreStatusServiceModule {
  static forRoot(options: StatusOptions): DynamicModule {
    return {
      module: CoreStatusServiceModule,
      providers: [
        {
          provide: ATTACH_STATUS_TRACKER,
          useFactory: service => {
            return attachStatusTrackerFactory(service);
          },
          inject: [StatusService]
        },

        {provide: STATUS_OPTIONS, useValue: options},
        StatusService
      ],
      exports: [ATTACH_STATUS_TRACKER, StatusService]
    };
  }
}
