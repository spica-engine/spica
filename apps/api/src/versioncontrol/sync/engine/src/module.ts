import {Module} from "@nestjs/common";
import {SyncEngine} from "./engine";
import {SyncProcessorsModule} from "@spica-server/versioncontrol/processors/sync";
import {ChangeLogProcessorsModule} from "@spica-server/versioncontrol/processors/changelog";

@Module({
  imports: [SyncProcessorsModule.forRoot(), ChangeLogProcessorsModule.forRoot()],
  providers: [SyncEngine],
  exports: [SyncEngine]
})
export class SyncEngineModule {}
