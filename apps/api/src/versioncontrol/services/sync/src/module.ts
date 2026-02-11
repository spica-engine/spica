import {Module} from "@nestjs/common";
import {SyncService} from "./service";

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
