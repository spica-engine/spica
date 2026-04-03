import {Module} from "@nestjs/common";
import {SyncProcessor} from "./processor.js";
import {ServicesModule, SyncService} from "@spica-server/versioncontrol-services-sync";
import {VCConfigService} from "./config.service.js";

@Module({})
export class SyncProcessorsModule {
  static forRoot() {
    return {
      module: SyncProcessorsModule,
      imports: [ServicesModule.forRoot()],
      providers: [
        VCConfigService,
        {
          provide: SyncProcessor,
          useFactory: (service: SyncService, vcConfigService: VCConfigService) => {
            return new SyncProcessor(service, vcConfigService);
          },
          inject: [SyncService, VCConfigService]
        }
      ],
      exports: [SyncProcessor, VCConfigService]
    };
  }
}
