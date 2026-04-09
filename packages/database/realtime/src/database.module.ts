import {Module} from "@nestjs/common";
import {RealtimeDatabaseService} from "./database.service.js";

@Module({
  providers: [RealtimeDatabaseService],
  exports: [RealtimeDatabaseService]
})
export class RealtimeDatabaseModule {}
