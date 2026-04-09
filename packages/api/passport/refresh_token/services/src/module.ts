import {Module} from "@nestjs/common";
import {RefreshTokenService} from "./service.js";

@Module({
  providers: [RefreshTokenService],
  exports: [RefreshTokenService]
})
export class RefreshTokenServicesModule {}
