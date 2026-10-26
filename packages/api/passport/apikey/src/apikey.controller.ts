import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
  Inject
} from "@nestjs/common";
import {activity} from "@spica-server/activity-services";
import {DEFAULT, JSONP, NUMBER} from "@spica-server/core";
import {Schema} from "@spica-server/core-schema";
import {ReturnDocument} from "@spica-server/database";
import {ID} from "@spica-server/data";
import {COLLECTION_QUERY, CollectionQueryFacade, Id} from "@spica-server/interface-data";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport-guard";
import {createApikeyActivity} from "./activity.resource.js";
import {ApiKeyService} from "./apikey.service.js";
import {ApiKey} from "@spica-server/interface-passport-apikey";
import {nanoid} from "nanoid";

@Controller("passport/apikey")
export class ApiKeyController {
  constructor(
    private apiKeyService: ApiKeyService,
    @Inject(COLLECTION_QUERY) private queries: CollectionQueryFacade
  ) {}

  @Get()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:apikey:index"))
  find(
    @ResourceFilter({collection: "apikey"}) resourceFilter: object,
    @Query("limit", DEFAULT(0), NUMBER) limit?: number,
    @Query("skip", DEFAULT(0), NUMBER) skip?: number,
    @Query("sort", JSONP) sort?: {[path: string]: 1 | -1}
  ) {
    return this.queries.paginate("apikey", {resourceFilter, sort, skip, limit}, "exact");
  }

  @Get(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:apikey:show"))
  findOne(@Param("id", ID("apikey")) id: Id) {
    return this.apiKeyService.findOne({_id: id}).then(r => {
      if (!r) {
        throw new NotFoundException();
      }
      return r;
    });
  }

  @UseInterceptors(activity(createApikeyActivity))
  @Post()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:apikey:create"))
  async insertOne(@Body(Schema.validate("http://spica.internal/passport/apikey")) apiKey: ApiKey) {
    if (!apiKey.key) {
      apiKey.key = nanoid(32);
    }
    apiKey.policies = [];
    return this.apiKeyService.insertOne(apiKey);
  }

  @UseInterceptors(activity(createApikeyActivity))
  @Put(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:apikey:update"))
  replaceOne(
    @Param("id", ID("apikey")) id: Id,
    @Body(Schema.validate("http://spica.internal/passport/apikey")) apiKey: ApiKey
  ) {
    delete apiKey.key;
    // We can't perform a replace operation on this endpoint because the "key" key is not present on this endpoint.
    return this.apiKeyService
      .findOneAndUpdate({_id: id}, {$set: apiKey}, {returnDocument: ReturnDocument.AFTER})
      .then(result => {
        if (!result) throw new NotFoundException();
        return result;
      });
  }

  @UseInterceptors(activity(createApikeyActivity))
  @Delete(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:apikey:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteOne(@Param("id", ID("apikey")) id: Id) {
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
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:apikey:policy:add"))
  async addPolicy(@Param("id", ID("apikey")) id: Id, @Param("policyId") policyId: string) {
    return this.apiKeyService
      .findOneAndUpdate(
        {
          _id: id
        },
        {
          $addToSet: {policies: policyId}
        },
        {
          returnDocument: ReturnDocument.AFTER
        }
      )
      .then(res => {
        if (!res) {
          throw new NotFoundException();
        }
        return res;
      });
  }

  /**
   * Removes the policy from an API Key.
   * @param id identifier of the api key.
   * @param policyId identifier of the policy. Example: `BucketFullAccess` or `5f31002e4a51a68d6fec4d3f`
   */
  @UseInterceptors(activity(createApikeyActivity))
  @Delete(":id/policy/:policyId")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:apikey:policy:remove"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePolicy(@Param("id", ID("apikey")) id: Id, @Param("policyId") policyId: string) {
    return this.apiKeyService
      .findOneAndUpdate(
        {
          _id: id
        },
        {
          $pull: {policies: policyId}
        },
        {
          returnDocument: ReturnDocument.AFTER
        }
      )
      .then(res => {
        if (!res) {
          throw new NotFoundException();
        }
        return res;
      });
  }
}
