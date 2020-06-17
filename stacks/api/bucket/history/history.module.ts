import {Module} from "@nestjs/common";
import {BucketWatcher} from "./watcher";
import {HistoryController} from "./history.controller";
import {HistoryService} from "./history.service";

@Module({
  controllers: [HistoryController],
  providers: [BucketWatcher, HistoryService],
  exports: [BucketWatcher]
})
export class HistoryModule {}
