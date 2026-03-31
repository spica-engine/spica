import {DynamicModule, Module} from "@nestjs/common";
import {RefreshTokenController} from "./controller";
import {REFRESH_TOKEN_OPTIONS, RefreshTokenOptions} from "./options";
import {RefreshTokenServicesModule} from "@spica-server/passport/refresh_token/services";
import {RefreshTokenRealtimeModule} from "@spica-server/passport/refresh_token/realtime";

@Module({})
export class RefreshTokenModule {
  static forRoot(options: RefreshTokenOptions & {realtime: boolean}): DynamicModule {
    const module: DynamicModule = {
      module: RefreshTokenModule,
      exports: [],
      controllers: [RefreshTokenController],
      imports: [RefreshTokenServicesModule],
      providers: [
        {
          provide: REFRESH_TOKEN_OPTIONS,
          useValue: options
        }
      ]
    };

    if (options.realtime) {
      module.imports.push(RefreshTokenRealtimeModule.register());
    }

    return module;
  }
}
