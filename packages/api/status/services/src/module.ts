import {DynamicModule, Global, Module} from "@nestjs/common";
import {attachStatusTrackerFactory} from "./interceptor.js";
import {
  StatusOptions,
  STATUS_OPTIONS,
  ATTACH_STATUS_TRACKER,
  STATUS_REPOSITORY
} from "@spica-server/interface-status";
import {provideRepository} from "@spica-server/data";
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
        provideRepository(STATUS_REPOSITORY),
        StatusService
      ],
      exports: [ATTACH_STATUS_TRACKER, StatusService]
    };
  }
}
