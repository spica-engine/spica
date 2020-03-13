import {Controller, Get, Param, Body, Post, Put} from "@nestjs/common";
import {PreferenceService} from "./preference.service";
import {OBJECT_ID, ObjectId} from "@spica-server/database";

@Controller("preference")
export class PreferenceController {
  constructor(private preference: PreferenceService) {}

  @Get(":scope")
  find(@Param("scope") scope: string) {
    return this.preference.get(scope);
  }

  @Post()
  insertOne(@Body() body: any) {
    return this.preference.insertOne(body);
  }

  @Put(":id")
  replaceOne(@Param("id", OBJECT_ID) id: ObjectId, @Body() body: any) {
    delete body._id;
    return this.preference.replaceOne({_id: id}, body);
  }
}
