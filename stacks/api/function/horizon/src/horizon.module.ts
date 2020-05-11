import {DynamicModule, Module} from "@nestjs/common";
import {Horizon} from "./horizon";
import {HorizonOptions, HORIZON_OPTIONS} from "./options";

@Module({})
export class HorizonModule {
  static forRoot(options: HorizonOptions): DynamicModule {
    return {
      module: HorizonModule,
      providers: [
        Horizon,
        {
          provide: HORIZON_OPTIONS,
          useValue: options
        }
      ],
      exports: [Horizon]
    };
  }
}
