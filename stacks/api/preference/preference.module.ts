import {Module, Global} from "@nestjs/common";
import {DatabaseModule} from "@spica-server/database";
import {PreferenceController} from "./preference.controller";
import {PreferenceService} from "./preference.service";

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [PreferenceController],
  providers: [PreferenceService],
  exports: [PreferenceService]
})
export class PreferenceModule {}
