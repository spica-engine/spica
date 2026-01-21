import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
  UseInterceptors,
  Optional,
  Inject
} from "@nestjs/common";
import {activity} from "@spica-server/activity/services";
import {AuthGuard, ActionGuard} from "@spica-server/passport/guard";
import {PreferenceService} from "@spica-server/preference/services";
import {
  Preference,
  BUCKET_LANGUAGE_FINALIZER,
  changeFactory
} from "@spica-server/interface/preference";
import {createPreferenceActivity} from "./activity.resource";
import {ReturnDocument} from "@spica-server/database";

@Controller("preference")
export class PreferenceController {
  constructor(
    private preference: PreferenceService,
    @Optional()
    @Inject(BUCKET_LANGUAGE_FINALIZER)
    private bucketFactory: changeFactory
  ) {}

  @Get(":scope")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("preference:show"))
  find(@Param("scope") scope: string) {
    return this.preference.get(scope);
  }

  @UseInterceptors(activity(createPreferenceActivity))
  @Put(":scope")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("preference:update"))
  async replaceOne(@Param("scope") scope: string, @Body() preference: Preference) {
    if (scope == "bucket" && this.bucketFactory) {
      const previousPrefs = await this.preference.get("bucket");

      await this.bucketFactory(previousPrefs, preference);
    }

    delete preference._id;
    preference.scope = scope;

    return this.preference.replace({scope}, preference, {
      upsert: true,
      returnDocument: ReturnDocument.AFTER
    });
  }
}
