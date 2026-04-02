import {DynamicModule, Module} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core/schema";
import {WebhookInvoker} from "./invoker.js";
import {SchemaResolver} from "./schema.js";
import {WebhookController} from "./webhook.controller.js";
import {WebhookService} from "./webhook.service.js";
import {WebhookLogService} from "./log.service.js";
import {WebhookLogController} from "./log.controller.js";
import {WebhookOptions, WEBHOOK_OPTIONS} from "@spica-server/interface/function/webhook";

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
        WebhookLogService,
        WebhookService,
        {
          provide: WEBHOOK_OPTIONS,
          useValue: options
        }
      ]
    };
  }
}
