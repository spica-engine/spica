import {DynamicModule, Module} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core/schema";
import {WebhookInvoker} from "./invoker";
import {SchemaResolver} from "./schema";
import {WebhookController} from "./webhook.controller";
import {WebhookService} from "./webhook.service";
import {WebhookLogService} from "./log.service";
import {WebhookLogController} from "./log.controller";
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
