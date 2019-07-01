import {DynamicModule, Module} from "@nestjs/common";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import {DatabaseModule} from "@spica-server/database";
import * as path from "path";
import {EngineModule, FunctionEngine, SubscriptionEngine} from "./engine";
import {EngineRegistry} from "./engine/registry";
import {FunctionController} from "./function.controller";
import {FunctionService} from "./function.service";
import {LanguageGateway} from "./language.gateway";
import {SubscriptionController} from "./subscription.controller";
import {SubscriptionService} from "./subscription.service";
import {provideTriggerSchemaResolver, TriggerSchemaResolver} from "./trigger.schema.resolver";

@Module({})
export class FunctionModule {
  constructor(
    fs: FunctionService,
    fe: FunctionEngine,
    ss: SubscriptionService,
    se: SubscriptionEngine
  ) {
    fs.find().then(fns => fns.forEach(f => fe.introduce(f)));
    ss.find().then(fns => fns.forEach(s => se.introduce(s)));
  }

  static forRoot(options: {path: string}): DynamicModule {
    const root = path.join(options.path, "functions");
    return {
      module: FunctionModule,
      imports: [
        DatabaseModule,
        SchemaModule.forChild({
          schemas: [require("./schemas/function.schema.json")]
        }),
        EngineModule.forRoot({root})
      ],
      controllers: [FunctionController, SubscriptionController],
      providers: [
        FunctionService,
        SubscriptionService,
        LanguageGateway,
        {
          provide: TriggerSchemaResolver,
          useFactory: provideTriggerSchemaResolver,
          inject: [Validator, EngineRegistry]
        }
      ]
    };
  }
}
