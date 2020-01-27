import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import {AuthGuard} from "@nestjs/passport";
import {DEFAULT, JSONP, NUMBER} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import * as uniqid from "uniqid";
import {ActionGuard} from "../policy/action.guard";
import {ApiKeyService} from "./apikey.service";
import {ApiKey} from "./interface";

@Controller("passport/apikey")
export class ApiKeyController {
  constructor(private aks: ApiKeyService) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("passport:apikey:index"))
  find(
    @Query("limit", DEFAULT(10), NUMBER) limit: number,
    @Query("skip", DEFAULT(0), NUMBER) skip: number,
    @Query("sort", JSONP) sort: {[k: string]: number}
  ) {
    const dataPipeline: object[] = [{$skip: skip}, {$limit: limit}];
    if (sort) {
      dataPipeline.push({$sort: sort});
    }
    const pipeline = [
      {
        $facet: {
          meta: [{$count: "total"}],
          data: dataPipeline
        }
      },
      {
        $set: {
          meta: {
            $cond: [
              {$arrayElemAt: ["$meta", 0]},
              {$arrayElemAt: ["$meta", 0]},
              {$const: {total: 0}}
            ]
          }
        }
      }
    ];
    return this.aks
      .aggregate(pipeline)
      .toArray()
      .then(r => r[0]);
  }

  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:apikey:show"))
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.aks.findOne({_id: id}).then(r => {
      if (!r) {
        throw new NotFoundException();
      }
      return r;
    });
  }

  @Post()
  @UseGuards(AuthGuard(), ActionGuard("passport:apikey:add"))
  insertOne(@Body(Schema.validate("http://spica.internal/passport/apikey")) apiKey: ApiKey) {
    delete apiKey._id;
    apiKey.key = uniqid();
    return this.aks.insertOne(apiKey).then(r => {
      apiKey._id = r;
      return apiKey;
    });
  }

  @Post(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:apikey:add"))
  updateOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/passport/apikey")) apiKey: ApiKey
  ) {
    delete apiKey._id;
    return this.aks.findOneAndUpdate({_id: id}, {$set: apiKey}, {returnOriginal: false}).then(r => {
      if (!r) {
        throw new NotFoundException();
      }
      return r;
    });
  }

  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:apikey:delete"))
  deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.aks.deleteOne({_id: id}).then(r => {
      if (!r) {
        throw new NotFoundException();
      }
      return r;
    });
  }
}
