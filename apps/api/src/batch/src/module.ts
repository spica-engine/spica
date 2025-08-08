import {Module, DynamicModule} from "@nestjs/common";
import {SchemaModule} from "../../../../../libs/core/schema";
import BatchSchema from "./schema/batch.json" with {type: "json"};
import {BatchController} from "./controller";
import {AxiosHttpService} from "./service";
import {BATCH_OPTIONS, BatchOptions, HTTP_SERVICE} from "../../../../../libs/interface/batch";

@Module({})
export class BatchModule {
  static forRoot(options: BatchOptions): DynamicModule {
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
        },
        {
          provide: BATCH_OPTIONS,
          useValue: options
        }
      ],
      exports: []
    };
  }
}
