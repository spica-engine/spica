import {Module} from "@nestjs/common";
import {provideRepository} from "@spica-server/data";
import {REFRESH_TOKEN_REPOSITORY} from "@spica-server/interface-passport-refresh_token";

@Module({
  providers: [provideRepository(REFRESH_TOKEN_REPOSITORY)],
  exports: [REFRESH_TOKEN_REPOSITORY]
})
export class RefreshTokenServicesModule {}
