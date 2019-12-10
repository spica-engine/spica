import {DynamicModule, Module} from "@nestjs/common";
import {SchemaModule, Validator} from "@spica-server/core/schema";
import {DatabaseModule} from "@spica-server/database";
import {HorizonModule} from "@spica-server/function/horizon";
import * as path from "path";
import {FunctionEngine} from "./engine";
import {FunctionController} from "./function.controller";
import {FunctionService} from "./function.service";
import {FUNCTION_OPTIONS} from "./interface";
import {EnqueuerSchemaResolver, provideEnqueuerSchemaResolver} from "./schema/enqueuer.resolver";

@Module({})
export class FunctionModule {
  static forRoot(options: {path: string}): DynamicModule {
    return {
      module: FunctionModule,
      imports: [
        DatabaseModule,
        SchemaModule.forChild({
          schemas: [require("./schema/function.json")]
        }),
        HorizonModule
      ],
      controllers: [FunctionController],
      providers: [
        FunctionEngine,
        FunctionService,
        {provide: FUNCTION_OPTIONS, useValue: {root: path.join(options.path, "functions")}},
        {
          provide: EnqueuerSchemaResolver,
          useFactory: provideEnqueuerSchemaResolver,
          inject: [Validator, FunctionEngine]
        }
      ]
    };
  }
}
