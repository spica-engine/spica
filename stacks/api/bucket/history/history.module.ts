import {Module} from "@nestjs/common";
import {HistoryController} from "./history.controller";
import {HistoryService} from "./history.service";

@Module({})
export class HistoryModule {
  static register() {
    return {
      module: HistoryModule,
      controllers: [HistoryController],
      providers: [HistoryService],
      exports: [HistoryService]
    };
  }
}
