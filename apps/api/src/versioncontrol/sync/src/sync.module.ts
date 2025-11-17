import {DynamicModule, Module} from "@nestjs/common";
import {SyncController} from "./sync.controller";
import {ServicesModule} from "@spica-server/versioncontrol/services/sync";
import {SyncRealtimeModule} from "@spica-server/versioncontrol/sync/realtime";

@Module({})
export class SyncModule {
  static forRoot(options: {realtime: boolean}): DynamicModule {
    const imports: any[] = [ServicesModule.forRoot()];

    if (options.realtime) {
      imports.push(SyncRealtimeModule.register());
    }

    return {
      module: SyncModule,
      imports,
      controllers: [SyncController]
    };
  }
}
