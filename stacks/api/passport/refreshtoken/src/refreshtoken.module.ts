import {DynamicModule, Module} from "@nestjs/common";
import {RefreshTokenController} from "./refreshtoken.controller";
import {RefreshTokenService} from "./refreshtoken.service";
import {REFRESHTOKEN_OPTIONS, RefreshTokenOptions} from "./options";
import {ScheduleModule} from "@nestjs/schedule";

@Module({})
export class RefreshTokenModule {
  static forRoot(options: RefreshTokenOptions): DynamicModule {
    return {
      module: RefreshTokenModule,
      imports: [ScheduleModule.forRoot()],
      exports: [RefreshTokenService],
      controllers: [RefreshTokenController],
      providers: [
        RefreshTokenService,
        {
          provide: REFRESHTOKEN_OPTIONS,
          useValue: options
        }
      ]
    };
  }
}
