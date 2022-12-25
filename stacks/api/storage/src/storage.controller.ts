import {
  BadRequestException,
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
  HttpCode,
  HttpException
} from "@nestjs/common";
import {activity} from "@spica-server/activity/services";
import {BOOLEAN, JSONP, NUMBER} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport/guard";
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

/**
 * @name storage
 */
@Controller("storage")
export class StorageController {
  constructor(private storage: StorageService) {}

  /**
   * @param limit The maximum amount documents that can be present in the response.
   * @param skip The amount of documents to skip.
   * @param sort A JSON string to sort the documents by its properties.
   * Example: Descending `{"content.size": -1}` OR Ascending `{"content.size": 1}`
   */
  @Get()
  @UseGuards(AuthGuard(), ActionGuard("storage:index"))
  async find(
    @ResourceFilter() resourceFilter: object,
    @Query("filter", JSONP) filter?: object,
    @Query("paginate", BOOLEAN) paginate?: boolean,
    @Query("limit", NUMBER) limit?: number,
    @Query("skip", NUMBER) skip?: number,
    @Query("sort", JSONP) sort?: object
  ) {
    return this.storage.getAll(resourceFilter, filter, paginate, limit, skip, sort);
  }

  /**
   * Returns content of the object along with http caching headers.
   * When `if-none-match` header is present and matches the objects checksum, it will end the response with status code 304
   * for futher information check: https://en.wikipedia.org/wiki/HTTP_ETag
   * @param id Identifier of the object
   * @param ifNoneMatch When present and matches objects checksum, status code will be 304.
   */
  @Get(":id/view")
  async view(
    @Res() res,
    @Param("id", OBJECT_ID) id: ObjectId,
    @Headers("if-none-match") ifNoneMatch?: string
  ) {
    const object = await this.storage.get(id);
    if (!object) {
      throw new NotFoundException("Could not find the object.");
    }
    const eTag = etag(object.content.data);
    if (eTag === ifNoneMatch) {
      return res.status(HttpStatus.NOT_MODIFIED).end();
    }
    res.header("Content-type", object.content.type);
    res.header("ETag", eTag);
    res.header("Cache-control", "public, max-age=3600, must-revalidate");
    res.end(object.content.data);
  }

  /**
   * Returns metadata of the object size, content-type and url.
   * @param id Identifier of the object
   */
  @Get(":id")
  async findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    const object = await this.storage.get(id);

    if (!object) {
      throw new NotFoundException("Could not find the object.");
    }

    object.url = await this.storage.getUrl(id.toHexString());

    delete object.content.data;
    return object;
  }

  @UseInterceptors(activity(createStorageActivity))
  @Put(":id/meta")
  @UseGuards(AuthGuard(), ActionGuard("storage:update","storage/:id"))
  updateMeta(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(
      Schema.validate({
        type: "object",
        properties: {
          name: {
            type: "string"
          }
        },
        additionalProperties: false
      })
    )
    {name}
  ) {
    return this.storage.updateMeta(id, name);
  }

  /**
   * Updates the object and content of the object.
   * @param id Identifier of the object
   * @body ```json
   * {
   *    "name": "updated name.txt",
   *    "content": {
   *      "type": "text/plain",
   *      "data": "Y29udGVudCBmcm9tIHN0b3JhZ2U="
   *    }
   * }
   * ```
   */
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
    object = await this.storage.update(id, object).catch(error => {
      throw new HttpException(error.message, error.status || 500);
    });
    object.url = await this.storage.getUrl(id.toHexString());
    return object;
  }

  /**
   * Adds one or more object into the storage.
   * @accepts application/json
   * @body ```json
   *  [
   *     {
   *       "name": "file.txt",
   *       "content": {
   *         "type": "text/plain",
   *         "data": "Y29udGVudCBmcm9tIHN0b3JhZ2U="
   *       }
   *     }
   *   ]
   * ```
   */
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

    objects = await this.storage.insert(objects).catch(error => {
      throw new HttpException(error.message, error.status || 500);
    });

    for (const object of objects) {
      object.url = await this.storage.getUrl(object._id.toString());
    }
    return objects;
  }

  /**
   * Removes the object from the storage along with its metadata
   * @param id Identifier of the object
   */
  @UseInterceptors(activity(createStorageActivity))
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard(), ActionGuard("storage:delete"))
  async deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.storage.delete(id);
  }
}
