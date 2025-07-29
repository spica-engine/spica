import {Module} from "@nestjs/common";
import {GuardService} from "./guard.service";

@Module({
  providers: [GuardService],
  exports: [GuardService]
})
export class GuardServiceModule {}
