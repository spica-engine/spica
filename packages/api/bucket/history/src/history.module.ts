import {Module} from "@nestjs/common";
import {HistoryController} from "./history.controller.js";
import {HistoryService} from "./history.service.js";

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
