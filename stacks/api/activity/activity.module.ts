import {Module} from "@nestjs/common";
import {ActivityController} from "./activity.controller";
import {ActivityService} from "./activity.service";
import {DatabaseModule} from "@spica-server/database";
import {ActivityInterceptor} from "./activity.logger";

@Module({
  imports: [DatabaseModule],
  controllers: [ActivityController],
  providers: [ActivityService, ActivityInterceptor]
})
export class ActivityModule {}
