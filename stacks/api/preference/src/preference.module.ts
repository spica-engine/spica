import {Global, Module} from "@nestjs/common";
import {DatabaseModule} from "@spica-server/database";
import {PreferenceService} from "../services";
import {PreferenceController} from "./preference.controller";

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [PreferenceController],
  providers: [PreferenceService],
  exports: [PreferenceService]
})
export class PreferenceModule {}
