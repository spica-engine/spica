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
import {DEFAULT, JSONP, NUMBER} from "@spica-server/core";
import {Schema} from "@spica-server/core/schema";
import {ObjectId, OBJECT_ID} from "@spica-server/database";
import * as uniqid from "uniqid";
import {AuthGuard} from "../auth.guard";
import {ActionGuard} from "../policy/action.guard";
import {ApiKeyService} from "./apikey.service";
import {ApiKey} from "./interface";
import {ActivityInterceptor} from "@spica-server/activity";
import {createApikeyResource, createApikeyPolicyResource} from "./activity.resource";

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

  @UseInterceptors(ActivityInterceptor(createApikeyResource))
  @Post()
  @UseGuards(AuthGuard(), ActionGuard("passport:apikey:insert"))
  insertOne(@Body(Schema.validate("http://spica.internal/passport/apikey")) apiKey: ApiKey) {
    apiKey.key = uniqid();
    return this.aks.insertOne(apiKey);
  }

  @UseInterceptors(ActivityInterceptor(createApikeyResource))
  @Put(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:apikey:update"))
  replaceOne(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/passport/apikey")) apiKey: ApiKey
  ) {
    delete apiKey.key;
    // We can't perform a replace operation on this endpoint because the "key" key is not present on this endpoint.
    return this.aks
      .findOneAndUpdate({_id: id}, {$set: apiKey}, {returnOriginal: false})
      .then(result => {
        if (!result) throw new NotFoundException();
        return result;
      });
  }

  @UseInterceptors(ActivityInterceptor(createApikeyResource))
  @Delete(":id")
  @UseGuards(AuthGuard(), ActionGuard("passport:apikey:delete"))
  deleteOne(@Param("id", OBJECT_ID) id: ObjectId) {
    return this.aks.deleteOne({_id: id}).then(r => {
      if (!r) {
        throw new NotFoundException();
      }
    });
  }

  @UseInterceptors(ActivityInterceptor(createApikeyPolicyResource))
  @Put(":id/attach-policy")
  @UseGuards(AuthGuard(), ActionGuard("passport:apikey:policy"))
  async attachPolicy(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/passport/policy-list")) policies: string[]
  ) {
    const apiKey = await this.aks.findOne({_id: id});
    if (!apiKey) throw new NotFoundException();

    apiKey.policies = new Array(...apiKey.policies, ...policies).filter((policy, index, array) => {
      return array.indexOf(policy) === index;
    });

    delete apiKey._id;
    return this.aks.findOneAndUpdate(
      {_id: id},
      {$set: {policies: apiKey.policies}},
      {returnOriginal: false}
    );
  }

  @UseInterceptors(ActivityInterceptor(createApikeyPolicyResource))
  @Put(":id/detach-policy")
  @UseGuards(AuthGuard(), ActionGuard("passport:apikey:policy"))
  async detachPolicy(
    @Param("id", OBJECT_ID) id: ObjectId,
    @Body(Schema.validate("http://spica.internal/passport/policy-list")) policies: string[]
  ) {
    const apiKey = await this.aks.findOne({_id: id});
    if (!apiKey) throw new NotFoundException();

    apiKey.policies = new Array(...apiKey.policies).filter(
      policy => policies.indexOf(policy) === -1
    );

    delete apiKey._id;
    return this.aks.findOneAndUpdate(
      {_id: id},
      {$set: {policies: apiKey.policies}},
      {returnOriginal: false}
    );
  }
}
