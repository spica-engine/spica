import {Global, Module} from "@nestjs/common";
import {StatusOptions, STATUS_OPTIONS} from "./interface";
import {StatusService} from "./service";

@Global()
@Module({})
export class CoreStatusServiceModule {
  static forRoot(options: StatusOptions) {
    return {
      module: CoreStatusServiceModule,
      providers: [{provide: STATUS_OPTIONS, useValue: options}, StatusService],
      exports: [StatusService]
    };
  }
}
