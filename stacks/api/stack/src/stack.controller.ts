import {Controller, Get, Param} from "@nestjs/common";

@Controller("stacks/:version")
export class StackController {
  @Get()
  find(@Param("version") version: string) {
    return [
      {
        version
      }
    ];
  }

  @Get(":name")
  get(@Param("version") version: string, @Param("name") name: string) {
    return {
      version,
      name
    };
  }
}
