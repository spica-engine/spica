import {Module} from "@nestjs/common";
import {Request} from "./request";

@Module({
  providers: [Request],
  exports: [Request]
})
export class CoreTestingModule {}
