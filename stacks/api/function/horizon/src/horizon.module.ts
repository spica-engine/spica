import {Module} from "@nestjs/common";
import {Horizon} from "./horizon";

@Module({
  imports: [],
  providers: [Horizon]
})
export class HorizonModule {
  constructor() {}
}
