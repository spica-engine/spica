import {Module} from "@nestjs/common";
import {SyncEngine} from "./engine";

@Module({
  providers: [SyncEngine]
})
export class SyncEngineModule {}
