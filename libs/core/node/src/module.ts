import {DynamicModule, Global, Module} from "@nestjs/common";
import {dirname} from "./dirname";
import { DIRNAME } from "./interface";

@Global()
@Module({})
export class NodeModule {
  static forRoot(): DynamicModule {
    return {
      module: NodeModule,
      providers: [
        {
          provide: DIRNAME,
          useValue: dirname
        }
      ],
      exports: [DIRNAME]
    };
  }
}
