import {Global, Module} from "@nestjs/common";
import {FunctionOptions, FUNCTION_OPTIONS} from "./options";
import {FunctionService} from "./service";

@Module({})
export class ServicesModule {
  static forRoot(options: FunctionOptions) {
    return {
      module: ServicesModule,
      providers: [
        FunctionService,
        {
          provide: FUNCTION_OPTIONS,
          useValue: options
        }
      ],
      exports: [FunctionService]
    };
  }
}
