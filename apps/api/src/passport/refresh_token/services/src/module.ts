import {Module} from "@nestjs/common";
import {RefreshTokenService} from "./service";

@Module({})
export class ServicesModule {
  static forRoot() {
    return {
      module: ServicesModule,
      providers: [RefreshTokenService],
      exports: [RefreshTokenService]
    };
  }
}
