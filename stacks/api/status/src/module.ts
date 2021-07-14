import {Module} from "@nestjs/common";
import {StatusController} from "./controller";
import {
  CoreStatusServiceModule,
  StatusInterceptor,
  StatusOptions
} from "@spica-server/status/services";
import {APP_INTERCEPTOR} from "@nestjs/core";

@Module({})
export class StatusModule {
  static forRoot(options: StatusOptions) {
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
