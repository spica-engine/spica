import {DynamicModule, Module} from "@nestjs/common";
import {RefreshTokenController} from "./controller";
import {REFRESH_TOKEN_OPTIONS, RefreshTokenOptions} from "./options";
import {RefreshTokenServicesModule} from "@spica-server/passport/refresh_token/services";

@Module({})
export class RefreshTokenModule {
  static forRoot(options: RefreshTokenOptions): DynamicModule {
    return {
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
  }
}
