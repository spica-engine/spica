import {Module} from "@nestjs/common";
import {RefreshTokenService} from "./service";

@Module({})
export class RefreshTokenServicesModule {
  static forRoot() {
    return {
      module: RefreshTokenServicesModule,
      providers: [RefreshTokenService],
      exports: [RefreshTokenService]
    };
  }
}
