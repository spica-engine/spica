import {Module} from "@nestjs/common";
import {RealtimeDatabaseService} from "./database.service";

@Module({
  providers: [RealtimeDatabaseService],
  exports: [RealtimeDatabaseService]
})
export class RealtimeDatabaseModule {}
