import {Body, Controller, Get, Param, Put, UseGuards} from "@nestjs/common";
import {Preference, PreferenceService} from "./service";
import {AuthGuard} from "@spica-server/passport";

@Controller("preference")
export class PreferenceController {
  constructor(private preference: PreferenceService) {}

  @Get(":scope")
  find(@Param("scope") scope: string) {
    return this.preference.get(scope);
  }

  @Put(":scope")
  @UseGuards(AuthGuard())
  replaceOne(@Param("scope") scope: string, @Body() preference: Preference) {
    delete preference._id;
    preference.scope = scope;
    return this.preference.replaceOne({scope}, preference, {upsert: true, returnOriginal: false});
  }
}
