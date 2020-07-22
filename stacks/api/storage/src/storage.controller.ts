import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  BadRequestException
} from "@nestjs/common";
import {activity} from "@spica-server/activity/services";
import {BOOLEAN, DEFAULT, JSONP, NUMBER} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard} from "@spica-server/passport";
import * as etag from "etag";
import {createStorageActivity} from "./activity.resource";
import {
  BsonBodyParser,
  isBsonBody,
  isJsonBody,
  JsonBodyParser,
  MixedBody,
  StorageObject
} from "./body";
import {StorageService} from "./storage.service";

@Controller("storage")
export class StorageController {
  constructor(private storage: StorageService) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("storage:index"))
  async findAll(
    @Query("limit", DEFAULT(0), NUMBER) limit: number,
    @Query("skip", NUMBER) skip: number,
    @Query("sort", JSONP, DEFAULT({_id: -1})) sort: object
  ) {
    return this.storage.getAll(limit, skip, sort);
  }

  @Get(":id/view")
  async view(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Headers("if-none-match") ifNoneMatch: string,
    @Res() res
  ) {
    const object = await this.storage.get(id);
    if (!object) {
      throw new NotFoundException("Could not find the object.");
    }
    const eTag = etag(object.content.data);
    if (eTag == ifNoneMatch) {
      return res.status(HttpStatus.NOT_MODIFIED).end();
    }
    res.header("Content-type", object.content.type);
    res.header("ETag", eTag);
    res.header("Cache-control", "public, max-age=3600, must-revalidate");
    res.end(object.content.data);
  }

  @Get(":id")
  async showOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Query("metadata", BOOLEAN) metadata: boolean,
    @Res() res
  ) {
    const object = await this.storage.get(id);

    if (!object) {
      throw new NotFoundException("Could not find the object.");
    }

    object.url = await this.storage.getUrl(id.toHexString());

    if (!metadata) {
      res.statusCode = 301;
      res.set({
        Location: object.url
      });

      return res.send({
        error: "Deprecated",
        message: "Fetching objects via this is deprecated.",
        url: object.url
      });
    }

    delete object.content.data;
    res.send(object);
  }

  @UseInterceptors(BsonBodyParser(), JsonBodyParser(), activity(createStorageActivity))
  @Put(":id")
  @UseGuards(AuthGuard(), ActionGuard("storage:update"))
  async updateOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/storage/body/single")) object: StorageObject
  ) {
    if (!(object.content.data instanceof Buffer)) {
      throw new BadRequestException("content.data should be a binary");
    }
    object._id = id;
    object.content.size = object.content.data.byteLength;
    object = await this.storage.updateOne({_id: id}, object);
    object.url = await this.storage.getUrl(id.toHexString());
    return object;
  }

  @UseInterceptors(BsonBodyParser(), JsonBodyParser(), activity(createStorageActivity))
  @Post()
  @UseGuards(AuthGuard(), ActionGuard("storage:create"))
  async insertMany(@Body(Schema.validate("http://spica.internal/storage/body")) body: MixedBody) {
    let objects = new Array<StorageObject>();
    if (isBsonBody(body)) {
      objects = body.content.map(object => {
        if (!(object.content.data instanceof Buffer)) {
          throw new BadRequestException("content.data should be a binary");
        }
        return {
          name: object.name,
          content: {
            type: object.content.type,
            data: object.content.data,
            size: object.content.data.byteLength
          }
        };
      });
    } else if (isJsonBody(body)) {
      objects = body.map(object => {
        return {
          name: object.name,
          content: {
            type: object.content.type,
            data: object.content.data,
            size: object.content.data.byteLength
          }
        };
      });
    }

    objects = await this.storage.insertMany(objects);

    for (const object of objects) {
      object.url = await this.storage.getUrl(object._id.toString());
    }
    return objects;
  }

  @UseInterceptors(activity(createStorageActivity))
  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("storage:delete"))
  async deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.storage.deleteOne(id);
  }
}
