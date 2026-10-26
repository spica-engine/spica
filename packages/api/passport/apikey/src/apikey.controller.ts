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
import {ID} from "@spica-server/data";
import {COLLECTION_QUERY, CollectionQueryFacade, Id} from "@spica-server/interface-data";
import {ActionGuard, AuthGuard, ResourceFilter} from "@spica-server/passport-guard";
import {createApikeyActivity} from "./activity.resource.js";
import {ApiKey, APIKEY_REPOSITORY, ApiKeyRepository} from "@spica-server/interface-passport-apikey";
import {nanoid} from "nanoid";

const APIKEY_COLLECTION = "apikey";

@Controller("passport/apikey")
export class ApiKeyController {
  constructor(
    @Inject(APIKEY_REPOSITORY) private apiKeys: ApiKeyRepository,
    @Inject(COLLECTION_QUERY) private queries: CollectionQueryFacade
  ) {}

  @Get()
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:apikey:index"))
  find(
    @ResourceFilter({collection: APIKEY_COLLECTION}) resourceFilter: object,
    @Query("limit", DEFAULT(0), NUMBER) limit?: number,
    @Query("skip", DEFAULT(0), NUMBER) skip?: number,
    @Query("sort", JSONP) sort?: {[path: string]: 1 | -1}
  ) {
    return this.queries.paginate(APIKEY_COLLECTION, {resourceFilter, sort, skip, limit}, "exact");
  }

  @Get(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:apikey:show"))
  findOne(@Param("id", ID(APIKEY_COLLECTION)) id: Id) {
    return this.apiKeys.findById(id).then(r => {
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
    return this.apiKeys.insert(apiKey);
  }

  @UseInterceptors(activity(createApikeyActivity))
  @Put(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:apikey:update"))
  replaceOne(
    @Param("id", ID(APIKEY_COLLECTION)) id: Id,
    @Body(Schema.validate("http://spica.internal/passport/apikey")) apiKey: ApiKey
  ) {
    delete apiKey.key;
    // We can't perform a replace operation on this endpoint because the "key" key is not present on this endpoint.
    return this.apiKeys.updateById(id, apiKey).then(result => {
      if (!result) throw new NotFoundException();
      return result;
    });
  }

  @UseInterceptors(activity(createApikeyActivity))
  @Delete(":id")
  @UseGuards(AuthGuard(["IDENTITY", "APIKEY"]), ActionGuard("passport:apikey:delete"))
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteOne(@Param("id", ID(APIKEY_COLLECTION)) id: Id) {
    return this.apiKeys.deleteById(id).then(r => {
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
  async addPolicy(@Param("id", ID(APIKEY_COLLECTION)) id: Id, @Param("policyId") policyId: string) {
    return this.apiKeys.addPolicy(id, policyId).then(res => {
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
  async removePolicy(
    @Param("id", ID(APIKEY_COLLECTION)) id: Id,
    @Param("policyId") policyId: string
  ) {
    return this.apiKeys.removePolicy(id, policyId).then(res => {
      if (!res) {
        throw new NotFoundException();
      }
      return res;
    });
  }
}
