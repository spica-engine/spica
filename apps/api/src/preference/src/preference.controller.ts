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
import {AuthGuard, ActionGuard} from "@spica-server/passport";
import {PreferenceService} from "@spica-server/preference/services";
import {
  Preference,
  BUCKET_LANGUAGE_FINALIZER,
  changeFactory,
  IDENTITY_SETTINGS_FINALIZER
} from "@spica-server/interface/preference";
import {createPreferenceActivity} from "./activity.resource";
import {ReturnDocument} from "@spica-server/database";

@Controller("preference")
export class PreferenceController {
  constructor(
    private preference: PreferenceService,
    @Optional()
    @Inject(BUCKET_LANGUAGE_FINALIZER)
    private bucketFactory: changeFactory,
    @Optional()
    @Inject(IDENTITY_SETTINGS_FINALIZER)
    private identityFactory: changeFactory
  ) {}

  @Get(":scope")
  @UseGuards(AuthGuard(), ActionGuard("preference:show"))
  find(@Param("scope") scope: string) {
    return this.preference.get(scope);
  }

  @UseInterceptors(activity(createPreferenceActivity))
  @Put(":scope")
  @UseGuards(AuthGuard(), ActionGuard("preference:update"))
  async replaceOne(@Param("scope") scope: string, @Body() preference: Preference) {
    if (scope == "bucket" && this.bucketFactory) {
      const previousPrefs = await this.preference.get("bucket");

      await this.bucketFactory(previousPrefs, preference);
    } else if (scope == "passport" && this.identityFactory) {
      const previousPrefs = await this.preference.get("passport");

      await this.identityFactory(previousPrefs, preference);
    }

    delete preference._id;
    preference.scope = scope;

    return this.preference.replace({scope}, preference, {
      upsert: true,
      returnDocument: ReturnDocument.AFTER
    });
  }
}
