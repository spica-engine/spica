import {DynamicModule, Global, Module} from "@nestjs/common";
import {attachStatusTrackerFactory} from "./interceptor.js";
import {StatusOptions, STATUS_OPTIONS, ATTACH_STATUS_TRACKER} from "@spica-server/interface-status";
import {StatusService} from "./service.js";

@Global()
@Module({})
export class CoreStatusServiceModule {
  static forRoot(options: StatusOptions): DynamicModule {
    return {
      module: CoreStatusServiceModule,
      providers: [
        {
          provide: ATTACH_STATUS_TRACKER,
          useFactory: (service, options: StatusOptions) => {
            return options.httpStatusTracking ? attachStatusTrackerFactory(service) : undefined;
          },
          inject: [StatusService, STATUS_OPTIONS]
        },

        {provide: STATUS_OPTIONS, useValue: options},
        StatusService
      ],
      exports: [ATTACH_STATUS_TRACKER, StatusService]
    };
  }
}
