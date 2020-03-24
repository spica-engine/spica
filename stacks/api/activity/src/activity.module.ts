import {Module, Global} from "@nestjs/common";
import {ActivityController} from "./activity.controller";
import {ActivityService} from "./activity.service";
import {DatabaseModule} from "@spica-server/database";

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService]
})
export class ActivityModule {}
