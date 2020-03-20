import {Body, Controller, Get, Param, Put, UseInterceptors} from "@nestjs/common";
import {Preference} from "./interface";
import {PreferenceService} from "./preference.service";
import {ActivityInterceptor, createActivity} from "@spica-server/activity";

@Controller("preference")
export class PreferenceController {
  constructor(private preference: PreferenceService) {}

  @Get(":scope")
  find(@Param("scope") scope: string) {
    return this.preference.get(scope);
  }

  @UseInterceptors(
    ActivityInterceptor({moduleName: "Preference", documentIdKey: "scope"})
  )
  @Put(":scope")
  replaceOne(@Param("scope") scope: string, @Body() preference: Preference) {
    delete preference._id;
    preference.scope = scope;
    return this.preference.replaceOne({scope}, preference, {upsert: true, returnOriginal: false});
  }
}
