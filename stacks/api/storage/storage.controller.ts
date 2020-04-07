import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import {activity} from "@spica-server/activity/services";
import {BOOLEAN, DEFAULT, JSONP, NUMBER} from "@spica-server/core";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard} from "@spica-server/passport";
import {Binary} from "bson";
import {createStorageResource} from "./activity.resource";
import {Storage, StorageObject} from "./storage.service";

@Controller("storage")
export class StorageController {
  constructor(public storage: Storage) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("storage:index"))
  async findAll(
    @Query("limit", NUMBER) limit: number,
    @Query("skip", NUMBER) skip: number,
    @Query("sort", JSONP, DEFAULT({_id: -1})) sort: object
  ) {
    const object = await this.storage.getAll(limit || 10, skip, sort);
    object.data = object.data.map(m => {
      m.url = `${process.env.PUBLIC_HOST}/storage/${m._id}`;
      return m;
    });

    return object;
  }

  @Get(":id")
  async showOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Query("withMeta", BOOLEAN) withMeta: boolean,
    @Res() res
  ) {
    const object = await this.storage.get(id);
    if (withMeta) {
      object.url = `${process.env.PUBLIC_HOST}/storage/${object._id}`;
      res.json(object);
    } else {
      res.header("Content-type", object.content.type);
      res.end(object.content.data);
    }
  }

  @UseInterceptors(activity(createStorageResource))
  @Put(":id")
  @UseGuards(AuthGuard(), ActionGuard("storage:update"))
  async updateOne(@Param("id", OBJECT_ID) id: ObjectId, @Body() object: StorageObject) {
    if (!object.content.data) {
      throw new BadRequestException("No content specified.");
    }

    object.content.data = ((object.content.data as any) as Binary).buffer;
    object.content.size = object.content.data.byteLength;

    return await this.storage.updateOne({_id: id}, object);
  }

  @UseInterceptors(activity(createStorageResource))
  @Post()
  @UseGuards(AuthGuard(), ActionGuard("storage:create"))
  async insertMany(@Body() object: StorageObject[]) {
    const insertData = [];

    for (let obj of Object.keys(object)) {
      if (!object[obj].content.data) {
        throw new BadRequestException("No content specified.");
      }

      object[obj].content.data = ((object[obj].content.data as any) as Binary).buffer;
      object[obj].content.size = object[obj].content.data.byteLength;

      insertData.push({
        name: object[obj].name,
        content: {
          type: object[obj].content.type,
          data: object[obj].content.data,
          size: object[obj].content.size
        }
      });
    }
    return await this.storage.insertMany(insertData);
  }

  @UseInterceptors(activity(createStorageResource))
  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("storage:delete"))
  async deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.storage.deleteOne(id);
  }
}
