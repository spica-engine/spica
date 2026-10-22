import {DynamicModule, Module} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core-schema";
import {WebhookInvoker} from "./invoker.js";
import {SchemaResolver} from "./schema.js";
import {WebhookController} from "./webhook.controller.js";
import {WebhookService} from "./webhook.service.js";
import {WebhookChangeDispatcher} from "./change-dispatcher.js";
import {WebhookLogController} from "./log.controller.js";
import {
  WebhookOptions,
  WEBHOOK_LOG_REPOSITORY,
  WEBHOOK_OPTIONS,
  WEBHOOK_REPOSITORY
} from "@spica-server/interface-function-webhook";
import {provideRepository} from "@spica-server/data";

@Module({})
export class WebhookModule {
  static forRoot(options: WebhookOptions): DynamicModule {
    return {
      module: WebhookModule,
      imports: [SchemaModule.forChild()],
      controllers: [WebhookLogController, WebhookController],
      providers: [
        WebhookInvoker,
        SchemaResolver,
        provideRepository(WEBHOOK_LOG_REPOSITORY),
        provideRepository(WEBHOOK_REPOSITORY),
        WebhookService,
        WebhookChangeDispatcher,
        {
          provide: WEBHOOK_OPTIONS,
          useValue: options
        }
      ]
    };
  }
}
