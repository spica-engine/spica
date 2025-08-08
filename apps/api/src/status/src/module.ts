import {DynamicModule, Module} from "@nestjs/common";
import {StatusController} from "./controller";
import {
  CoreStatusServiceModule,
  StatusInterceptor,
  StatusService
} from "../services";
import {StatusOptions} from "../../../../../libs/interface/status";
import {APP_INTERCEPTOR} from "@nestjs/core";
import {registerStatusProvider} from "./status";

@Module({})
export class StatusModule {
  constructor(service: StatusService) {
    registerStatusProvider(service);
  }

  static forRoot(options: StatusOptions): DynamicModule {
    return {
      module: StatusModule,
      controllers: [StatusController],
      imports: [CoreStatusServiceModule.forRoot(options)],
      providers: [
        {
          provide: APP_INTERCEPTOR,
          useClass: StatusInterceptor
        }
      ]
    };
  }
}
