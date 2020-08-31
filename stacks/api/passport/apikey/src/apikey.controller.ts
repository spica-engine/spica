import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import {activity} from "@spica-server/activity/services";
import {DEFAULT, JSONP, NUMBER} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport/guard";
import * as uniqid from "uniqid";
import {createApikeyActivity} from "./activity.resource";
import {ApiKeyService} from "./apikey.service";
import {ApiKey} from "./interface";

@Controller("passport/apikey")
export class ApiKeyController {
  constructor(private apiKeyService: ApiKeyService) {}

  @Get()
  @UseGuards(AuthGuard(), ActionGuard("passport:apikey:index"))
  find(
    @ResourceFilter() resourceFilter: object,
    @Query("limit", DEFAULT(0), NUMBER) limit?: number,
    @Query("skip", DEFAULT(0), NUMBER) skip?: number,
    @Query("sort", JSONP) sort?: {[k: string]: number}
  ) {
    let dataPipeline: object[] = [{$skip: skip}];

    if (limit) {
      dataPipeline.push({$limit: limit});
    }

    if (sort) {
      dataPipeline.push({$sort: sort});
    }

    const pipeline = [
      resourceFilter,
      {
        $facet: {
          meta: [{$count: "total"}],
          data: dataPipeline
        }
      },
      {
        $set: {
          meta: {
            $ifNull: [{$arrayElemAt: ["$meta", 0]}, {$const: {total: 0}}]
          }
        }
      }
    ];
    return this.apiKeyService.aggregate(pipeline).next();
  }

  @Get(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:apikey:show"))
  findOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.apiKeyService.findOne({_id: id}).then(r => {
      if (!r) {
        throw new NotFoundException();
      }
      return r;
    });
  }

  @UseInterceptors(activity(createApikeyActivity))
  @Post()
  @UseGuards(AuthGuard(), ActionGuard("passport:apikey:create"))
  insertOne(@Body(Schema.validate("http://spica.internal/passport/apikey")) apiKey: ApiKey) {
    apiKey.key = uniqid();
    apiKey.policies = [];
    return this.apiKeyService.insertOne(apiKey);
  }

  @UseInterceptors(activity(createApikeyActivity))
  @Put(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:apikey:update"))
  replaceOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/passport/apikey")) apiKey: ApiKey
  ) {
    delete apiKey.key;
    // We can't perform a replace operation on this endpoint because the "key" key is not present on this endpoint.
    return this.apiKeyService
      .findOneAndUpdate({_id: id}, {$set: apiKey}, {returnOriginal: false})
      .then(result => {
        if (!result) throw new NotFoundException();
        return result;
      });
  }

  @UseInterceptors(activity(createApikeyActivity))
  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:apikey:delete"))
  deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.apiKeyService.deleteOne({_id: id}).then(r => {
      if (!r) {
        throw new NotFoundException();
      }
    });
  }

  @UseInterceptors(activity(createApikeyActivity))
  @Put(":id/attach-policy")
  @UseGuards(AuthGuard(), ActionGuard("passport:apikey:policy"))
  async attachPolicy(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/passport/policy-list")) policies: string[]
  ) {
    const apiKey = await this.apiKeyService.findOne({_id: id});
    if (!apiKey) throw new NotFoundException();

    apiKey.policies = new Array(...apiKey.policies, ...policies).filter((policy, index, array) => {
      return array.indexOf(policy) === index;
    });

    delete apiKey._id;
    return this.apiKeyService.findOneAndUpdate(
      {_id: id},
      {$set: {policies: apiKey.policies}},
      {returnOriginal: false}
    );
  }

  @UseInterceptors(activity(createApikeyActivity))
  @Put(":id/detach-policy")
  @UseGuards(AuthGuard(), ActionGuard("passport:apikey:policy"))
  async detachPolicy(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/passport/policy-list")) policies: string[]
  ) {
    const apiKey = await this.apiKeyService.findOne({_id: id});
    if (!apiKey) throw new NotFoundException();

    apiKey.policies = new Array(...apiKey.policies).filter(
      policy => policies.indexOf(policy) === -1
    );

    delete apiKey._id;
    return this.apiKeyService.findOneAndUpdate(
      {_id: id},
      {$set: {policies: apiKey.policies}},
      {returnOriginal: false}
    );
  }
}
