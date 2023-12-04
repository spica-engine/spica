import {Global, Module} from "@nestjs/common";
import {attachHttpCounterFactory, attachInvocationCounterFactory} from "./interceptor";
import {
  StatusOptions,
  STATUS_OPTIONS,
  ATTACH_HTTP_COUNTER,
  ATTACH_INVOCATION_COUNTER
} from "./interface";
import {InvocationService, StatusService} from "./service";

@Global()
@Module({})
export class CoreStatusServiceModule {
  static forRoot(options: StatusOptions) {
    return {
      module: CoreStatusServiceModule,
      providers: [
        {
          provide: ATTACH_HTTP_COUNTER,
          useFactory: service => {
            return attachHttpCounterFactory(service);
          },
          inject: [StatusService]
        },
        {
          provide: ATTACH_INVOCATION_COUNTER,
          useFactory: service => {
            return attachInvocationCounterFactory(service);
          },
          inject: [InvocationService]
        },

        {provide: STATUS_OPTIONS, useValue: options},
        StatusService,
        InvocationService
      ],
      exports: [ATTACH_HTTP_COUNTER, ATTACH_INVOCATION_COUNTER, StatusService, InvocationService]
    };
  }
}
