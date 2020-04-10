import {DynamicModule, Module} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core/schema";
import {WebhookInvoker} from "./invoker";
import {SchemaResolver} from "./schema";
import {WebhookController} from "./webhook.controller";
import {WebhookService} from "./webhook.service";
import {WebhookLogService} from "./log.service";
import {WebhookLogController} from "./log.controller";

@Module({})
export class WebhookModule {
  static forRoot(): DynamicModule {
    return {
      module: WebhookModule,
      imports: [SchemaModule.forChild()],
      controllers: [WebhookLogController, WebhookController],
      providers: [WebhookInvoker, SchemaResolver, WebhookLogService, WebhookService]
    };
  }
}
