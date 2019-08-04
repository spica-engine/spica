import {Module} from "@nestjs/common";
import {BucketWatcher} from "./watcher";
import {HistoryController} from "./history.controller";
import {HistoryService} from "./history.service";

@Module({
  controllers: [HistoryController],
  providers: [BucketWatcher, HistoryService]
})
export class HistoryModule {
  constructor(bw: BucketWatcher) {
    bw.watch();
  }
}
