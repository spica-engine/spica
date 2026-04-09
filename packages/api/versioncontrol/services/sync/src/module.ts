import {Module} from "@nestjs/common";
import {SyncService} from "./service.js";

@Module({})
export class ServicesModule {
  static forRoot() {
    return {
      module: ServicesModule,
      providers: [SyncService],
      exports: [SyncService]
    };
  }
}
