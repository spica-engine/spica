import {Module} from "@nestjs/common";
import {SyncProcessor} from "./processor";
import {ServicesModule, SyncService} from "@spica-server/versioncontrol/services/sync";

@Module({})
export class SyncProcessorsModule {
  static forRoot() {
    return {
      module: SyncProcessorsModule,
      imports: [ServicesModule.forRoot()],
      providers: [
        {
          provide: SyncProcessor,
          useFactory: (service: SyncService) => {
            return new SyncProcessor(service);
          },
          inject: [SyncService]
        }
      ],
      exports: [SyncProcessor]
    };
  }
}
