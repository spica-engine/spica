import {Controller, Get, Param, Body, Post} from "@nestjs/common";
import {PreferenceService} from "./preference.service";

@Controller("preference")
export class PreferenceController {
  constructor(private preference: PreferenceService) {}

  @Get(":scope")
  find(@Param("scope") scope: string) {
    return this.preference.get(scope);
  }

  @Post()
  update(@Body() body: any) {
    return this.preference.update(body);
  }
}
