import {DynamicModule, Module} from "@nestjs/common";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import {SchedulerModule} from "@spica-server/function/scheduler";
import {WebhookModule} from "@spica-server/function/webhook";
import * as path from "path";
import {FunctionEngine} from "./engine";
import {FunctionController} from "./function.controller";
import {FunctionService} from "./function.service";
import {FUNCTION_OPTIONS} from "./options";
import {LogController} from "./log.controller";
import {LogService} from "./log.service";
import {FunctionOptions} from "./options";
import {EnqueuerSchemaResolver, provideEnqueuerSchemaResolver} from "./schema/enqueuer.resolver";

@Module({})
export class FunctionModule {
  static forRoot(options: FunctionOptions): DynamicModule {
    return {
      module: FunctionModule,
      imports: [
        SchemaModule.forChild({
          schemas: [require("./schema/function.json")]
        }),
        WebhookModule.forRoot(),
        SchedulerModule.forRoot({
          databaseName: options.databaseName,
          databaseReplicaSet: options.databaseReplicaSet,
          databaseUri: options.databaseUri,
          poolSize: options.poolSize,
          publicUrl: options.publicUrl,
          timeout: options.timeout
        })
      ],
      controllers: [LogController, FunctionController],
      providers: [
        FunctionEngine,
        FunctionService,
        LogService,
        {
          provide: FUNCTION_OPTIONS,
          useValue: {root: path.join(options.path, "functions"), timeout: options.timeout}
        },
        {
          provide: EnqueuerSchemaResolver,
          useFactory: provideEnqueuerSchemaResolver,
          inject: [Validator, FunctionEngine]
        }
      ]
    };
  }
}
