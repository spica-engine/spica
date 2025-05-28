import {DynamicModule, Module} from "@nestjs/common";
import {RefreshTokenController} from "./controller";
import {RefreshTokenService} from "./service";
import {REFRESH_TOKEN_OPTIONS, RefreshTokenOptions} from "./options";

@Module({})
export class RefreshTokenModule {
  static forRoot(options: RefreshTokenOptions): DynamicModule {
    return {
      module: RefreshTokenModule,
      exports: [RefreshTokenService],
      controllers: [RefreshTokenController],
      providers: [
        RefreshTokenService,
        {
          provide: REFRESH_TOKEN_OPTIONS,
          useValue: options
        }
      ]
    };
  }
}
