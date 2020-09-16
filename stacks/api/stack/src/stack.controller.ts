import {Controller, Get, Param} from "@nestjs/common";
import {definitions} from "./definitions";

@Controller("apis")
export class StackController {
  @Get()
  definitions() {
    return definitions;
  }

  @Get(":group/:version/:name")
  find(
    @Param("group") group: string,
    @Param("version") version: string,
    @Param("name") name: string
  ) {
    return {
      group,
      version,
      name
    }
  }
}
