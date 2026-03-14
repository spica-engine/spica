import {Module} from "@nestjs/common";
import {ChangeLogProcessor} from "./processor";
import {ChangeLogService, ServicesModule} from "@spica-server/versioncontrol/services/changelog";

@Module({})
export class ChangeLogProcessorsModule {
  static forRoot() {
    return {
      module: ChangeLogProcessorsModule,
      imports: [ServicesModule.forRoot()],
      providers: [
        {
          provide: ChangeLogProcessor,
          useFactory: (changeLogService: ChangeLogService) => {
            return new ChangeLogProcessor(changeLogService);
          },
          inject: [ChangeLogService]
        }
      ],
      exports: [ChangeLogProcessor]
    };
  }
}
