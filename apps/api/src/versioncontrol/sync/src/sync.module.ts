import {Module} from "@nestjs/common";
import {SyncController} from "./sync.controller";
import {ServicesModule} from "@spica-server/versioncontrol/services/sync";

@Module({
  imports: [ServicesModule.forRoot()],
  controllers: [SyncController]
})
export class SyncModule {}
