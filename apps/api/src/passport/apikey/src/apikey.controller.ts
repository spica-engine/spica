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
import {DEFAULT, JSONP, NUMBER} from "@spica/core";
import {Schema} from "@spica/core";
import {ObjectId, OBJECT_ID} from "@spica/database";
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
    const dataPipeline: object[] = [];

    if (sort) {
      dataPipeline.push({$sort: sort});
    }

    // sub-pipeline in $facet stage cannot be empty
    dataPipeline.push({$skip: skip});

    if (limit) {
      dataPipeline.push({$limit: limit});
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
    apiKey.key = apiKey.key || uniqid();
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

  /**
   * Add the policy to an API Key.
   * @param id identifier of the api key.
   * @param policyId identifier of the policy. Example: `BucketFullAccess` or `5f31002e4a51a68d6fec4d3f`
   */
  @UseInterceptors(activity(createApikeyActivity))
  @Put(":id/policy/:policyId")
  @UseGuards(AuthGuard(), ActionGuard("passport:apikey:policy:add"))
  async addPolicy(@Param("id", OBJECT_ID) id: ObjectId, @Param("policyId") policyId: string) {
    return this.apiKeyService.findOneAndUpdate(
      {
        _id: id
      },
      {
        $addToSet: {policies: policyId}
      },
      {
        returnOriginal: false
      }
    );
  }

  /**
   * Removes the policy from an API Key.
   * @param id identifier of the api key.
   * @param policyId identifier of the policy. Example: `BucketFullAccess` or `5f31002e4a51a68d6fec4d3f`
   */
  @UseInterceptors(activity(createApikeyActivity))
  @Delete(":id/policy/:policyId")
  @UseGuards(AuthGuard(), ActionGuard("passport:apikey:policy:remove"))
  async removePolicy(@Param("id", OBJECT_ID) id: ObjectId, @Param("policyId") policyId: string) {
    return this.apiKeyService.findOneAndUpdate(
      {
        _id: id
      },
      {
        $pull: {policies: policyId}
      },
      {
        returnOriginal: false
      }
    );
  }
}
