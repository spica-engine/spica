import {Body, Controller, Get, Param, Post, Put} from "@nestjs/common";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {Preference} from "./interface";
import {PreferenceService} from "./preference.service";

@Controller("preference")
export class PreferenceController {
  constructor(private preference: PreferenceService) {}

  @Get(":scope")
  find(@Param("scope") scope: string) {
    return this.preference.get(scope);
  }

  @Post()
  insertOne(@Body() body: Preference) {
    return this.preference.insertOne(body);
  }

  @Put(":id")
  replaceOne(@Param("id", OBJECT_ID) id: ObjectId, @Body() body: Preference) {
    delete body._id;
    return this.preference.replaceOne({_id: id}, body);
  }
}
