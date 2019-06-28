import {Module} from "@nestjs/common";
import {BucketDataService} from "../bucket-data.service";
import {BucketHistorian} from "./bucket-historian";
import {HistoryController} from "./history.controller";
import {HistoryService} from "./history.service";

@Module({
  controllers: [HistoryController],
  providers: [BucketHistorian, HistoryService, BucketDataService]
})
export class HistoryModule {
  constructor(bw: BucketHistorian) {
    bw.watch();
  }
}
