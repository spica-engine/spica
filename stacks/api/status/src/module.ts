import {Module} from "@nestjs/common";
import {StatusController} from "./controller";

@Module({
  controllers: [StatusController]
})
export class StatusModule {}
