import {DynamicModule, Module} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core/schema";
import {WebhookInvoker} from "./invoker";
import {SchemaResolver} from "./schema";
import {WebhookController} from "./webhook.controller";
import {WebhookService} from "./webhook.service";

@Module({
  providers: [WebhookService]
})
export class WebhookModule {
  static forRoot(): DynamicModule {
    return {
      module: WebhookModule,
      imports: [SchemaModule.forChild()],
      controllers: [WebhookController],
      providers: [WebhookInvoker, SchemaResolver]
    };
  }
}
