import {Module} from "@nestjs/common";
import {ChangeLogService} from "./service";

@Module({})
export class ServicesModule {
  static forRoot() {
    return {
      module: ServicesModule,
      providers: [ChangeLogService],
      exports: [ChangeLogService]
    };
  }
}
