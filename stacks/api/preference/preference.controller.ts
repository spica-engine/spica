import {ActivityInterceptor} from "@spica-server/activity";
import {createPreferenceResource} from "./activity.resource";
import {Body, Controller, Get, Param, Put, UseGuards, UseInterceptors} from "@nestjs/common";
import {Preference, PreferenceService} from "./service";
import {AuthGuard} from "@spica-server/passport";

@Controller("preference")
export class PreferenceController {
  constructor(private preference: PreferenceService) {}

  @Get(":scope")
  find(@Param("scope") scope: string) {
    return this.preference.get(scope);
  }

  @UseInterceptors(ActivityInterceptor(createPreferenceResource))
  @Put(":scope")
  @UseGuards(AuthGuard())
  replaceOne(@Param("scope") scope: string, @Body() preference: Preference) {
    delete preference._id;
    preference.scope = scope;
    return this.preference.replaceOne({scope}, preference, {upsert: true, returnOriginal: false});
  }
}
