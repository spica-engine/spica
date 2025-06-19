import {Module} from "@nestjs/common";
import {RefreshTokenService} from "./service";

@Module({
  providers: [RefreshTokenService],
  exports: [RefreshTokenService]
})
export class RefreshTokenServicesModule {}
