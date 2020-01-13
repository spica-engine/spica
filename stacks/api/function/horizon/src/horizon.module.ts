import {Module} from "@nestjs/common";
import {HttpAdapterHost} from "@nestjs/core";
import {Horizon} from "./horizon";

@Module({
  imports: [],
  providers: [
    {
      provide: Horizon,
      useClass: Horizon,
      inject: [HttpAdapterHost]
    }
  ],
  exports: [Horizon]
})
export class HorizonModule {}
