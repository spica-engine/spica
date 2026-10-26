import {Module} from "@nestjs/common";
import {provideRepository} from "@spica-server/data";
import {HISTORY_REPOSITORY} from "@spica-server/interface-bucket-history";
import {HistoryController} from "./history.controller.js";

@Module({})
export class HistoryModule {
  static register() {
    return {
      module: HistoryModule,
      controllers: [HistoryController],
      providers: [provideRepository(HISTORY_REPOSITORY)],
      exports: [HISTORY_REPOSITORY]
    };
  }
}
