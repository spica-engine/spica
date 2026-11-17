import {
  DynamicModule,
  Global,
  MiddlewareConsumer,
  Module,
  NestModule,
  OnModuleInit
} from "@nestjs/common";
import {installTracePropagation} from "@spica-server/core-trace";
import {HttpTrackerOptions, createHttpTracker} from "./http-tracker.js";
import {HttpTrackerMiddleware} from "./http-tracker.middleware.js";
import {HTTP_TRACKER} from "./tokens.js";

@Global()
@Module({})
export class HttpTrackerModule implements NestModule, OnModuleInit {
  static forRoot(options: HttpTrackerOptions): DynamicModule {
    return {
      module: HttpTrackerModule,
      providers: [{provide: HTTP_TRACKER, useValue: createHttpTracker(options)}],
      exports: [HTTP_TRACKER]
    };
  }

  onModuleInit() {
    installTracePropagation();
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpTrackerMiddleware).forRoutes("*");
  }
}
