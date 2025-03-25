import {Module, DynamicModule} from "@nestjs/common";
import {SchemaModule} from "@spica-server/core/schema";
import BatchSchema from "./schema/batch.json" with {type: "json"};
import {BatchController} from "./controller";
import {AxiosHttpService} from "./service";
import {HTTP_SERVICE} from "./interface";

@Module({})
export class BatchModule {
  static forRoot(): DynamicModule {
    return {
      module: BatchModule,
      imports: [
        SchemaModule.forChild({
          schemas: [BatchSchema]
        })
      ],
      controllers: [BatchController],
      providers: [
        {
          provide: HTTP_SERVICE,
          useClass: AxiosHttpService
        }
      ],
      exports: []
    };
  }
}
